import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
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
import { InventoryService } from '../inventory/inventory.service';
import { KDSGateway } from '../kds/kds.gateway';
import { OrderToken } from '../order-tokens/entities/order-token.entity';

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
    @InjectRepository(OrderToken) private orderTokenRepo: Repository<OrderToken>,
    private inventoryService: InventoryService,
    private kdsGateway: KDSGateway,
    private dataSource: DataSource,
  ) {}

  private generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    return `ORD-${ts}`;
  }

  private generateTokenPublicCode() {
    return randomBytes(5).toString('hex').toUpperCase();
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
        attentionType: null,
        attentionRequestedAt: null,
      });
      }

      if ((dto.source ?? 'POS') === 'TOKEN') {
        const tokenRepo = manager.getRepository(OrderToken);
        const latestToken = await tokenRepo.findOne({
          where: { sessionId: order.sessionId },
          order: { displayNumber: 'DESC' },
        });

        let publicCode = this.generateTokenPublicCode();
        while (await tokenRepo.findOne({ where: { publicCode } })) {
          publicCode = this.generateTokenPublicCode();
        }

        await tokenRepo.save(tokenRepo.create({
          orderId: order.id,
          sessionId: order.sessionId,
          displayNumber: (latestToken?.displayNumber ?? 0) + 1,
          publicCode,
          status: 'ISSUED',
        }));
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

  emitDispatchTickets(tickets: KDSTicket[]) {
    for (const ticket of tickets) {
      if (ticket.type === 'ADDON') {
        this.kdsGateway.emitAddonTicket(ticket);
      } else {
        this.kdsGateway.emitNewTicket(ticket);
      }
    }
  }

  async dispatchPendingItemsInTransaction(
    manager: EntityManager,
    orderId: string,
  ): Promise<{ order: Order; tickets: KDSTicket[]; dispatchedCount: number }> {
    const order = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid' || order.status === 'Voided') {
      throw new BadRequestException('Cannot dispatch a completed order');
    }

    const pendingItems = order.items.filter((i) => i.status === 'Pending');
    if (!pendingItems.length) {
      return { order, tickets: [], dispatchedCount: 0 };
    }

    const isAddon = order.status === 'Sent';
    const table = order.tableId
      ? await manager.findOne(Table, { where: { id: order.tableId } })
      : null;
    const tableNumber = table?.number ?? undefined;

    const productIds = [...new Set(pendingItems.map((i) => i.productId))];
    const products = productIds.length
      ? await manager.find(Product, {
          where: { id: In(productIds) },
          relations: ['category'],
        })
      : [];
    const stationMap = new Map<string, 'KITCHEN' | 'BREWBAR'>(
      products.map((p) => [p.id, (p.category?.station ?? 'KITCHEN') as 'KITCHEN' | 'BREWBAR']),
    );

    const kitchenItems = pendingItems.filter((i) => stationMap.get(i.productId) === 'KITCHEN');
    const brewbarItems = pendingItems.filter((i) => stationMap.get(i.productId) === 'BREWBAR');

    const resolvedInventory = await this.inventoryService.resolveIngredientRequirements(
      manager,
      pendingItems,
    );
    const recipeBackedItemIds = new Set(resolvedInventory.recipeBackedItemIds);
    const legacyStockItems = pendingItems.filter((item) => !recipeBackedItemIds.has(item.id));

    await manager.update(
      OrderLineItem,
      pendingItems.map((i) => i.id),
      { status: 'Sent' },
    );

    await this.inventoryService.applyIngredientRequirements(
      manager,
      resolvedInventory.requirements,
      {
        type: 'ORDER_CONSUMPTION',
        referenceType: 'Order',
        referenceId: orderId,
        reason: isAddon ? 'Addon fired to station' : 'Order fired to station',
      },
    );

    for (const item of legacyStockItems) {
      if (item.productId) {
        await manager.decrement(Product, { id: item.productId }, 'stockQty', item.quantity);
      }
    }

    const ticketType: 'ADDON' | 'NEW' = isAddon ? 'ADDON' : 'NEW';
    const tickets: KDSTicket[] = [];

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
      tickets.push(await manager.save(KDSTicket, ticket));
    }

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
      tickets.push(await manager.save(KDSTicket, ticket));
    }

    if (order.status !== 'Sent') {
      await manager.update(Order, orderId, { status: 'Sent' });
    }

    if (order.tableId) {
      await manager.update(Table, order.tableId, {
        status: 'Occupied',
        occupiedSince: table?.occupiedSince ?? new Date(),
        currentOrderId: order.id,
        currentBill: Number(order.total),
      });
    }

    const updatedOrder = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['items'],
    });
    if (!updatedOrder) throw new NotFoundException('Order not found after dispatch');

    return { order: updatedOrder, tickets, dispatchedCount: pendingItems.length };
  }

  async syncPaidOrderTableStateInTransaction(manager: EntityManager, orderId: string): Promise<void> {
    const order = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order || !order.tableId) return;

    const hasOutstandingItems = order.items.some(
      (item) => item.status !== 'Done' && item.status !== 'Voided',
    );

    if (hasOutstandingItems) {
      const table = await manager.findOne(Table, { where: { id: order.tableId } });
      await manager.update(Table, order.tableId, {
        status: 'Occupied',
        occupiedSince: table?.occupiedSince ?? new Date(),
        currentOrderId: order.id,
        currentBill: Number(order.total),
        attentionType: null,
        attentionRequestedAt: null,
      });
      return;
    }

    await manager.update(Table, order.tableId, {
      status: 'Available',
      occupiedSince: null,
      currentOrderId: null,
      currentBill: null,
      attentionType: null,
      attentionRequestedAt: null,
    } as any);
  }

  async sendToKitchen(orderId: string): Promise<Order> {
    let tickets: KDSTicket[] = [];

    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: ['items'],
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid' || order.status === 'Voided') {
        throw new BadRequestException('Cannot send a completed order to kitchen');
      }

      const dispatch = await this.dispatchPendingItemsInTransaction(manager, orderId);
      if (!dispatch.dispatchedCount) throw new BadRequestException('No pending items to send');
      tickets = dispatch.tickets;
      return dispatch.order;
    });

    this.emitDispatchTickets(tickets);
    return result;
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
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(OrderLineItem, { where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Item not found');
      if (item.status === 'Voided') throw new BadRequestException('Item already voided');

      if ((item.status === 'Sent' || item.status === 'Done') && user.role !== 'Admin' && user.role !== 'Manager') {
        throw new ForbiddenException('Only Admin or Manager can void items that were already sent or completed');
      }

      if (item.status === 'Sent' || item.status === 'Done') {
        const resolved = await this.inventoryService.resolveIngredientRequirements(manager, [item]);
        if (resolved.recipeBackedItemIds.includes(item.id)) {
          await this.inventoryService.applyIngredientRequirements(
            manager,
            this.inventoryService.invertRequirements(resolved.requirements),
            {
              actorId: user.id,
              type: 'ORDER_REPLENISHMENT',
              referenceType: 'OrderLineItem',
              referenceId: itemId,
              reason: dto.reason ?? 'Void item',
            },
          );
        } else {
          await manager.increment(Product, { id: item.productId }, 'stockQty', item.quantity);
        }
      }

      await manager.update(OrderLineItem, itemId, {
        status: 'Voided',
        voidedBy: user.id,
        voidReason: dto.reason,
      });

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          actorId: user.id,
          action: 'VOID_ITEM',
          entityType: 'OrderLineItem',
          entityId: itemId,
          metaBefore: { status: item.status },
          metaAfter: { status: 'Voided', reason: dto.reason },
        }),
      );

      const allItems = await manager.find(OrderLineItem, { where: { orderId } });
      const order = await manager.findOneOrFail(Order, { where: { id: orderId }, relations: ['items'] });
      const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
      await manager.update(Order, orderId, { subtotal, tax, total });

      return this.findOne(orderId);
    });
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
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(OrderLineItem, { where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Item not found');

      if (item.status === 'Sent' || item.status === 'Done') {
        const resolved = await this.inventoryService.resolveIngredientRequirements(manager, [item]);
        if (resolved.recipeBackedItemIds.includes(item.id)) {
          await this.inventoryService.applyIngredientRequirements(
            manager,
            this.inventoryService.invertRequirements(resolved.requirements),
            {
              type: 'ORDER_REPLENISHMENT',
              referenceType: 'OrderLineItem',
              referenceId: itemId,
              reason: 'Remove sent item',
            },
          );
        } else {
          await manager.increment(Product, { id: item.productId }, 'stockQty', item.quantity);
        }
      }

      await manager.delete(OrderLineItem, itemId);

      const allItems = await manager.find(OrderLineItem, { where: { orderId } });
      const order = await manager.findOneOrFail(Order, { where: { id: orderId }, relations: ['items'] });
      const { subtotal, tax, total } = this.calcTotals(allItems, Number(order.discount), Number(order.tip));
      await manager.update(Order, orderId, { subtotal, tax, total });

      return this.findOne(orderId);
    });
  }

  async updateTip(orderId: string, tip: number): Promise<Order> {
    const order = await this.findOne(orderId);
    const total = Number(order.subtotal) + Number(order.tax) - Number(order.discount) + tip;
    await this.orderRepo.update(orderId, { tip, total });
    return this.findOne(orderId);
  }

  async voidOrder(orderId: string, user: User): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId }, relations: ['items'] });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid') throw new BadRequestException('Cannot void a paid order');
      if (order.status === 'Voided') throw new BadRequestException('Order already voided');

      const fulfilledItems = order.items.filter((i) => i.status === 'Sent' || i.status === 'Done');
      const resolved = await this.inventoryService.resolveIngredientRequirements(manager, fulfilledItems);
      const recipeBackedItemIds = new Set(resolved.recipeBackedItemIds);

      if (resolved.requirements.length) {
        await this.inventoryService.applyIngredientRequirements(
          manager,
          this.inventoryService.invertRequirements(resolved.requirements),
          {
            actorId: user.id,
            type: 'ORDER_REPLENISHMENT',
            referenceType: 'Order',
            referenceId: orderId,
            reason: 'Void order',
          },
        );
      }

      for (const item of fulfilledItems.filter((entry) => !recipeBackedItemIds.has(entry.id))) {
        await manager.increment(Product, { id: item.productId }, 'stockQty', item.quantity);
      }

      await manager.update(OrderLineItem, { orderId }, { status: 'Voided' });
      await manager.update(Order, orderId, { status: 'Voided' });

      if (order.tableId) {
        await manager.update(Table, order.tableId, {
          status: 'Available',
          currentOrderId: null,
          currentBill: null,
          occupiedSince: null,
        });
      }

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          actorId: user.id,
          action: 'VOID_ORDER',
          entityType: 'Order',
          entityId: orderId,
          metaBefore: { status: order.status },
          metaAfter: { status: 'Voided' },
        }),
      );

      return this.findOne(orderId);
    });
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
      const resolved = await this.inventoryService.resolveIngredientRequirements(manager, fulfilledItems);
      const recipeBackedItemIds = new Set(resolved.recipeBackedItemIds);

      if (resolved.requirements.length) {
        await this.inventoryService.applyIngredientRequirements(
          manager,
          this.inventoryService.invertRequirements(resolved.requirements),
          {
            actorId: user.id,
            type: 'ORDER_REPLENISHMENT',
            referenceType: 'Order',
            referenceId: orderId,
            reason: 'Cancel order',
          },
        );
      }

      for (const item of fulfilledItems.filter((entry) => !recipeBackedItemIds.has(entry.id))) {
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
