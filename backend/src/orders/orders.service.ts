import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderLineItem } from './entities/order-line-item.entity';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { Product } from '../products/entities/product.entity';
import { Category } from '../products/entities/category.entity';
import { Table } from '../tables/entities/table.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { KDSTicket } from '../kds/entities/kds-ticket.entity';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderLineItem) private itemRepo: Repository<OrderLineItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Table) private tableRepo: Repository<Table>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(KDSTicket) private kdsRepo: Repository<KDSTicket>,
    private dataSource: DataSource,
  ) {}

  private generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    return `ORD-${ts}`;
  }

  private calcTotals(items: OrderLineItem[], discount = 0, tip = 0) {
    const subtotal = items
      .filter((i) => i.status !== 'Voided')
      .reduce((sum, i) => {
        // unitPrice already includes modifier prices (set by the client at add time)
        return sum + Number(i.unitPrice) * i.quantity;
      }, 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax - discount + tip;
    return { subtotal, tax, total };
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        orderNumber: this.generateOrderNumber(),
        sessionId: dto.sessionId,
        tableId: dto.tableId,
        source: (dto.source ?? 'POS') as any,
        status: 'Open' as const,
      });
      await manager.save(Order, order);

      const lineItems = (dto.items ?? []).map((item) =>
        manager.create(OrderLineItem, {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity ?? 1,
          modifiers: item.modifiers ?? [],
          note: item.note,
          status: 'Pending' as const,
        }),
      );
      if (lineItems.length) await manager.save(OrderLineItem, lineItems);

      const { subtotal, tax, total } = this.calcTotals(lineItems);
      await manager.update(Order, order.id, { subtotal, tax, total });

      // Mark table as Occupied if applicable
      if (dto.tableId) {
        await manager.update(Table, dto.tableId, {
          status: 'Occupied',
          occupiedSince: new Date(),
          currentOrderId: order.id,
        });
      }

      const result = await manager.findOne(Order, {
        where: { id: order.id },
        relations: ['items'],
      });
      if (!result) throw new NotFoundException('Order creation failed');
      return result;
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAll(query: { tableId?: string; sessionId?: string; status?: OrderStatus }) {
    const where: Record<string, unknown> = {};
    if (query.tableId) where.tableId = query.tableId;
    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.status) where.status = query.status;

    return this.orderRepo.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async sendToKitchen(orderId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid' || order.status === 'Voided') {
        throw new BadRequestException('Cannot send a completed order to kitchen');
      }

      const pendingItems = order.items.filter((i) => i.status === 'Pending');
      if (!pendingItems.length) throw new BadRequestException('No pending items to send');

      const isAddon = order.status === 'Sent';

      // Look up table number for display
      let tableNumber: string | undefined;
      if (order.tableId) {
        const table = await manager.findOne(Table, { where: { id: order.tableId } });
        tableNumber = table?.number ?? undefined;
      }

      // Resolve category stations for routing
      const productIds = [...new Set(pendingItems.map((i) => i.productId))];
      const products = await manager.find(Product, {
        where: { id: In(productIds) },
        relations: ['category'],
      });
      const stationMap = new Map<string, 'KITCHEN' | 'BREWBAR'>(
        products.map((p) => [p.id, (p.category?.station ?? 'KITCHEN') as 'KITCHEN' | 'BREWBAR']),
      );

      // Split items by station
      const kitchenItems = pendingItems.filter((i) => stationMap.get(i.productId) === 'KITCHEN');
      const brewbarItems = pendingItems.filter((i) => stationMap.get(i.productId) === 'BREWBAR');

      // Mark all pending items as Sent
      await manager.update(
        OrderLineItem,
        pendingItems.map((i) => i.id),
        { status: 'Sent' },
      );

      // Decrement stock
      for (const item of pendingItems) {
        if (item.productId) {
          await manager.decrement(Product, { id: item.productId }, 'stockQty', item.quantity);
        }
      }

      const ticketType = (isAddon ? 'ADDON' : 'NEW') as any;

      // Create Kitchen ticket (food)
      if (kitchenItems.length) {
        const ticket = manager.create(KDSTicket, {
          orderId,
          orderNumber: order.orderNumber,
          tableNumber,
          station: 'KITCHEN' as const,
          type: ticketType,
          stage: 'TO_COOK' as const,
          items: kitchenItems.map((i) => ({
            itemId: i.id,
            name: i.productName,
            quantity: i.quantity,
            note: i.note ?? null,
            modifiers: i.modifiers ?? [],
          })),
        });
        await manager.save(KDSTicket, ticket);
      }

      // Create Brewbar ticket (beverages)
      if (brewbarItems.length) {
        const ticket = manager.create(KDSTicket, {
          orderId,
          orderNumber: order.orderNumber,
          tableNumber,
          station: 'BREWBAR' as const,
          type: ticketType,
          stage: 'TO_COOK' as const,
          items: brewbarItems.map((i) => ({
            itemId: i.id,
            name: i.productName,
            quantity: i.quantity,
            note: i.note ?? null,
            modifiers: i.modifiers ?? [],
          })),
        });
        await manager.save(KDSTicket, ticket);
      }

      await manager.update(Order, orderId, { status: 'Sent' });

      // Update table status
      if (order.tableId) {
        await manager.update(Table, order.tableId, {
          status: 'Occupied',
          occupiedSince: order.tableId ? (new Date()) : undefined,
        });
      }

      const result = await manager.findOne(Order, { where: { id: orderId }, relations: ['items'] });
      if (!result) throw new NotFoundException('Order not found after send');
      return result;
    });
  }

  async addItems(orderId: string, items: OrderItemDto[]): Promise<Order> {
    const order = await this.findOne(orderId);
    if (order.status === 'Paid' || order.status === 'Voided') {
      throw new BadRequestException('Cannot add items to a closed order');
    }

    const newItems = items.map((item) =>
      this.itemRepo.create({
        orderId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity ?? 1,
        modifiers: item.modifiers ?? [],
        note: item.note,
        status: 'Pending' as const,
      }),
    );
    await this.itemRepo.save(newItems);

    const allItems = await this.itemRepo.find({ where: { orderId } });
    const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
    await this.orderRepo.update(orderId, { subtotal, tax, total });

    return this.findOne(orderId);
  }

  async voidItem(orderId: string, itemId: string, dto: VoidItemDto, user: User): Promise<Order> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === 'Voided') throw new BadRequestException('Item already voided');

    if ((item.status === 'Sent' || item.status === 'Done') && user.role !== 'Admin' && user.role !== 'Manager') {
      throw new ForbiddenException('Only Admin or Manager can void items that were already sent or completed');
    }

    if (item.status === 'Sent' || item.status === 'Done') {
      await this.productRepo.increment({ id: item.productId }, 'stockQty', item.quantity);
    }

    await this.itemRepo.update(itemId, {
      status: 'Voided',
      voidedBy: user.id,
      voidReason: dto.reason,
    });

    await this.auditRepo.save(
      this.auditRepo.create({
        actorId: user.id,
        action: 'VOID_ITEM',
        entityType: 'OrderLineItem',
        entityId: itemId,
        metaBefore: { status: item.status },
        metaAfter: { status: 'Voided', reason: dto.reason },
      }),
    );

    const allItems = await this.itemRepo.find({ where: { orderId } });
    const order = await this.findOne(orderId);
    const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
    await this.orderRepo.update(orderId, { subtotal, tax, total });

    return this.findOne(orderId);
  }

  async applyDiscount(orderId: string, dto: ApplyDiscountDto, user: User): Promise<Order> {
    const order = await this.findOne(orderId);

    let discountAmount: number;
    if (dto.type === 'PERCENTAGE') {
      discountAmount = (Number(order.subtotal) * dto.value) / 100;
    } else {
      discountAmount = dto.value;
    }

    const { subtotal, tax } = this.calcTotals(order.items);
    const total = subtotal + tax - discountAmount + Number(order.tip);

    await this.orderRepo.update(orderId, { discount: discountAmount, total });

    await this.auditRepo.save(
      this.auditRepo.create({
        actorId: user.id,
        action: 'APPLY_DISCOUNT',
        entityType: 'Order',
        entityId: orderId,
        metaBefore: { discount: order.discount },
        metaAfter: { discount: discountAmount, reason: dto.reason },
      }),
    );

    return this.findOne(orderId);
  }

  async updateItemQuantity(orderId: string, itemId: string, quantity: number): Promise<Order> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === 'Voided') throw new BadRequestException('Cannot update voided item');

    await this.itemRepo.update(itemId, { quantity });

    const allItems = await this.itemRepo.find({ where: { orderId } });
    const order = await this.findOne(orderId);
    const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
    await this.orderRepo.update(orderId, { subtotal, tax, total });

    return this.findOne(orderId);
  }

  async removeItem(orderId: string, itemId: string): Promise<Order> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException('Item not found');

    if (item.status === 'Sent' || item.status === 'Done') {
      await this.productRepo.increment({ id: item.productId }, 'stockQty', item.quantity);
    }

    await this.itemRepo.delete(itemId);

    const allItems = await this.itemRepo.find({ where: { orderId } });
    const order = await this.findOne(orderId);
    const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
    await this.orderRepo.update(orderId, { subtotal, tax, total });

    return this.findOne(orderId);
  }

  async updateTip(orderId: string, tip: number): Promise<Order> {
    const order = await this.findOne(orderId);
    const total = Number(order.subtotal) + Number(order.tax) - Number(order.discount) + tip;
    await this.orderRepo.update(orderId, { tip, total });
    return this.findOne(orderId);
  }

  async voidOrder(orderId: string, user: User): Promise<Order> {
    const order = await this.findOne(orderId);
    if (order.status === 'Paid') throw new BadRequestException('Cannot void a paid order');
    if (order.status === 'Voided') throw new BadRequestException('Order already voided');

    // Restore stock for sent items
    const fulfilledItems = order.items.filter((i) => i.status === 'Sent' || i.status === 'Done');
    for (const item of fulfilledItems) {
      await this.productRepo.increment({ id: item.productId }, 'stockQty', item.quantity);
    }

    await this.itemRepo.update(
      { orderId },
      { status: 'Voided' },
    );
    await this.orderRepo.update(orderId, { status: 'Voided' });

    // Free the table
    if (order.tableId) {
      await this.tableRepo.update(order.tableId, {
        status: 'Available',
        currentOrderId: null,
        currentBill: null,
        occupiedSince: null,
      });
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        actorId: user.id,
        action: 'VOID_ORDER',
        entityType: 'Order',
        entityId: orderId,
        metaBefore: { status: order.status },
        metaAfter: { status: 'Voided' },
      }),
    );

    return this.findOne(orderId);
  }

  async cancelOrder(orderId: string, user: User): Promise<{ deleted: true }> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid') {
        throw new BadRequestException('Cannot cancel a paid order');
      }

      // Restore stock for any items that were already sent to kitchen
      const fulfilledItems = order.items.filter((i) => i.status === 'Sent' || i.status === 'Done');
      for (const item of fulfilledItems) {
        await manager.increment(Product, { id: item.productId }, 'stockQty', item.quantity);
      }

      // Audit log
      await manager.save(
        manager.create(AuditLog, {
          actorId: user.id,
          action: 'CANCEL_ORDER',
          entityType: 'Order',
          entityId: orderId,
          metaBefore: { status: order.status, itemCount: order.items.length },
          metaAfter: { status: 'Cancelled' },
        }),
      );

      if (order.tableId) {
        await manager.update(Table, order.tableId, {
          status: 'Available',
          currentOrderId: null,
          currentBill: null,
          occupiedSince: null,
        } as any);
      }

      await manager.delete(Payment, { orderId });
      await manager.delete(KDSTicket, { orderId });
      // Delete all line items then the order
      await manager.delete(OrderLineItem, { orderId });
      await manager.delete(Order, orderId);

      return { deleted: true };
    });
  }
}
