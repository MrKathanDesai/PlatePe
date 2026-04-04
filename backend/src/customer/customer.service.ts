import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Customer } from './entities/customer.entity';
import { FirebaseService } from './firebase.service';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Table } from '../tables/entities/table.entity';
import { Session } from '../sessions/entities/session.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { PaymentMethod } from '../payments/entities/payment.entity';
import { PaymentsService } from '../payments/payments.service';
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
    private jwtService: JwtService,
    private dataSource: DataSource,
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
    private firebaseService: FirebaseService,
  ) {}

  /** Verify a Firebase ID token (phone or email) → return a customer JWT */
  async verifyFirebaseToken(idToken: string, name?: string) {
    let decoded: Awaited<ReturnType<FirebaseService['verifyIdToken']>>;
    try {
      decoded = await this.firebaseService.verifyIdToken(idToken);
    } catch (e: any) {
      this.logger.error(`Firebase token verification failed: ${e?.code} — ${e?.message}`);
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }

    // Email sign-in: use email as identifier; Phone sign-in: use phone number
    const email = decoded.email ?? null;
    const rawPhone = decoded.phone_number ?? null;
    const phone = rawPhone ? rawPhone.replace(/^\+91/, '') : null;

    if (!email && !phone) {
      throw new UnauthorizedException('Token contains neither email nor phone number');
    }

    const where = email ? { email } : { phone: phone! };

    // Look up by whichever identifier we have
    let customer = await this.customerRepo.findOne({ where });

    if (!customer) {
      try {
        customer = await this.customerRepo.save(
          this.customerRepo.create({ phone, email, name: name ?? null }),
        );
      } catch (e: any) {
        const isUniqueViolation =
          e instanceof QueryFailedError
          && e.driverError?.code === '23505';

        if (!isUniqueViolation) throw e;

        // Email-link sign-in can be fired twice in quick succession in dev,
        // so fall back to the row that just won the race.
        customer = await this.customerRepo.findOne({ where });
        if (!customer) throw e;
      }
    }

    if (name && !customer.name) {
      await this.customerRepo.update(customer.id, { name });
      customer.name = name;
    }

    const token = this.jwtService.sign(
      { sub: customer.id, type: 'customer' },
      { expiresIn: '24h' },
    );

    return { token, customer: { id: customer.id, phone: customer.phone, email: customer.email, name: customer.name } };
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
    void customerId;

    let dispatchedTickets: KDSTicket[] = [];

    const updatedOrder = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId }, relations: ['items'] });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid' || order.status === 'Voided') {
        throw new BadRequestException('Cannot add items to a completed order');
      }

      const lineItems = items.map((item) => {
        const modifiers = item.modifiers ?? [];
        const modifiersTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0);

        return manager.create(OrderLineItem, {
          orderId,
          productId: item.productId,
          productName: item.productName,
          // Keep customer-created line items aligned with POS totals.
          unitPrice: Number(item.unitPrice) + modifiersTotal,
          quantity: item.quantity ?? 1,
          modifiers,
          note: item.note ?? undefined,
          status: 'Pending' as any,
        });
      });

      await manager.save(OrderLineItem, lineItems);

      const allItems = await manager.find(OrderLineItem, { where: { orderId } });
      const active = allItems.filter((item) => item.status !== 'Voided');
      const subtotal = active.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
      const tax = subtotal * 0.05;
      const total = subtotal + tax;

      await manager.update(Order, orderId, { subtotal, tax, total });

      const dispatch = await this.ordersService.dispatchPendingItemsInTransaction(manager, orderId);
      dispatchedTickets = dispatch.tickets;
      return dispatch.order;
    });

    this.ordersService.emitDispatchTickets(dispatchedTickets);
    return updatedOrder;
  }

  /** Get order with live status */
  async getOrder(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async payForOrder(
    customerId: string,
    orderId: string,
    method: PaymentMethod,
    upiRef?: string,
  ) {
    void customerId;

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid') throw new BadRequestException('Order already paid');
    if (order.status === 'Voided') throw new BadRequestException('Order is voided');

    const payment = await this.paymentsService.createAndConfirmCustomerPayment({
      orderId,
      method,
      upiRef,
    });

    const updatedOrder = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!updatedOrder) throw new NotFoundException('Order not found after payment');

    return {
      success: true,
      orderId,
      orderNumber: updatedOrder.orderNumber,
      orderStatus: updatedOrder.status,
      paymentId: payment.id,
      paymentMethod: payment.method,
    };
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
