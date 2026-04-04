import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Customer } from './entities/customer.entity';
import { FirebaseService } from './firebase.service';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Table } from '../tables/entities/table.entity';
import { Session } from '../sessions/entities/session.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { KDSGateway } from '../kds/kds.gateway';
import { OrdersService } from '../orders/orders.service';
import { KDSTicket } from '../kds/entities/kds-ticket.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Table) private tableRepo: Repository<Table>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderLineItem) private itemRepo: Repository<OrderLineItem>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private dataSource: DataSource,
    private kdsGateway: KDSGateway,
    private ordersService: OrdersService,
    private firebaseService: FirebaseService,
  ) {}

  /** Verify a Firebase Phone Auth ID token → return a customer JWT */
  async verifyFirebaseToken(idToken: string, name?: string) {
    let decoded: Awaited<ReturnType<FirebaseService['verifyIdToken']>>;
    try {
      decoded = await this.firebaseService.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }

    const phone = decoded.phone_number;
    if (!phone) throw new UnauthorizedException('Token does not contain a phone number');

    // Normalise to 10-digit Indian number (strip +91)
    const normalised = phone.replace(/^\+91/, '');

    let customer = await this.customerRepo.findOne({ where: { phone: normalised } });
    if (!customer) {
      customer = await this.customerRepo.save(
        this.customerRepo.create({ phone: normalised, name: name ?? null }),
      );
    } else if (name && !customer.name) {
      await this.customerRepo.update(customer.id, { name });
      customer.name = name;
    }

    const token = this.jwtService.sign(
      { sub: customer.id, phone: customer.phone, type: 'customer' },
      { expiresIn: '24h' },
    );

    return { token, customer: { id: customer.id, phone: customer.phone, name: customer.name } };
  }

  /** Public menu — all active, non-86d products with their categories */
  async getMenu() {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const products = await this.productRepo.find({
      where: { isActive: true, is86d: false },
      relations: ['category', 'modifiers'],
      order: { name: 'ASC' },
    });

    return categories
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        station: cat.station,
        products: products
          .filter((p) => p.categoryId === cat.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: Number(p.price),
            image: p.image,
            modifiers: p.modifiers?.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })) ?? [],
          })),
      }))
      .filter((c) => c.products.length > 0);
  }

  /** Get table info + active session */
  async getTableSession(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId, isActive: true } });
    if (!table) throw new NotFoundException('Table not found');

    const session = await this.sessionRepo.findOne({
      where: { status: 'ACTIVE' },
      order: { startTime: 'DESC' },
    });

    return {
      table: { id: table.id, number: table.number, seats: table.seats, status: table.status },
      sessionId: session?.id ?? null,
      sessionActive: !!session,
    };
  }

  /** Get or create an order for the customer on this table */
  async getOrCreateOrder(customerId: string, tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId, isActive: true } });
    if (!table) throw new NotFoundException('Table not found');

    const session = await this.sessionRepo.findOne({
      where: { status: 'ACTIVE' },
      order: { startTime: 'DESC' },
    });
    if (!session) throw new BadRequestException('No active session — restaurant not open yet');

    // Check if table already has an open/sent order for this customer
    if (table.currentOrderId) {
      const existing = await this.orderRepo.findOne({
        where: { id: table.currentOrderId },
        relations: ['items'],
      });
      if (existing && (existing.status === 'Open' || existing.status === 'Sent')) {
        return existing;
      }
    }

    // Create new order
    return this.dataSource.transaction(async (manager) => {
      const orderNum = `ORD-${Date.now().toString(36).toUpperCase().slice(-8)}`;
      const order = manager.create(Order, {
        orderNumber: orderNum,
        sessionId: session.id,
        tableId,
        source: 'SELF' as any,
        status: 'Open' as any,
        subtotal: 0,
        tax: 0,
        discount: 0,
        tip: 0,
        total: 0,
      });
      const saved = await manager.save(Order, order);

      await manager.update(Table, tableId, {
        status: 'Occupied',
        occupiedSince: new Date(),
        currentOrderId: saved.id,
      });

      return manager.findOne(Order, { where: { id: saved.id }, relations: ['items'] });
    });
  }

  /** Add items to the order */
  async addItems(customerId: string, orderId: string, items: {
    productId: string; productName: string; unitPrice: number;
    quantity?: number; modifiers?: { id: string; name: string; price: number }[]; note?: string;
  }[]) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid' || order.status === 'Voided') {
      throw new BadRequestException('Cannot add items to a completed order');
    }

    const lineItems = items.map((item) =>
      this.itemRepo.create({
        orderId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity ?? 1,
        modifiers: item.modifiers ?? [],
        note: item.note ?? undefined,
        status: 'Pending' as any,
      }),
    );

    await this.itemRepo.save(lineItems);
    await this.recalcOrder(orderId);

    return this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
  }

  /** Get order with live status */
  async getOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Create a Razorpay order for payment */
  async createRazorpayOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid') throw new BadRequestException('Order already paid');

    const keyId = this.configService.get('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      throw new BadRequestException('Razorpay not configured');
    }

    const amount = Math.round(Number(order.total) * 100); // paise
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: orderId.slice(0, 40),
        notes: { orderId, orderNumber: order.orderNumber },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Razorpay error: ${err}`);
    }

    const rzpOrder = await response.json() as { id: string; amount: number; currency: string };

    return {
      rzpOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId,
      orderNumber: order.orderNumber,
    };
  }

  /** Verify Razorpay payment signature and mark order as paid */
  async verifyRazorpayPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    orderId: string,
  ) {
    const keySecret = this.configService.get('RAZORPAY_KEY_SECRET', '');

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new UnauthorizedException('Invalid payment signature');
    }

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid') {
      return { success: true, orderId, orderNumber: order.orderNumber };
    }

    let dispatchedTickets: KDSTicket[] = [];
    let paidOrderTotal: number | null = null;

    await this.dataSource.transaction(async (manager) => {
      const dispatch = await this.ordersService.dispatchPendingItemsInTransaction(manager, orderId);
      dispatchedTickets = dispatch.tickets;
      await manager.update(Order, orderId, { status: 'Paid' });

      await manager.save(Payment, manager.create(Payment, {
        orderId,
        method: 'DIGITAL' as any,
        amount: order.total,
        status: 'CONFIRMED' as any,
        upiRef: razorpayPaymentId,
      }));

      await this.ordersService.syncPaidOrderTableStateInTransaction(manager, orderId);
      paidOrderTotal = Number(order.total);
    });

    this.ordersService.emitDispatchTickets(dispatchedTickets);
    if (paidOrderTotal !== null) {
      this.kdsGateway.emitOrderPaid({ orderId, total: paidOrderTotal });
    }

    return { success: true, orderId, orderNumber: order.orderNumber };
  }

  private async recalcOrder(orderId: string) {
    const items = await this.itemRepo.find({ where: { orderId } });
    const active = items.filter((i) => i.status !== 'Voided');
    const subtotal = active.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    await this.orderRepo.update(orderId, { subtotal, tax, total });
  }
}
