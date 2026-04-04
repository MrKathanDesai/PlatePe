import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Payment, PaymentMethod } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import {
  CreatePaymentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  SplitBillDto,
} from './dto/create-payment.dto';
import { User } from '../auth/entities/user.entity';
import { KDSGateway } from '../kds/kds.gateway';
import { OrdersService } from '../orders/orders.service';
import { KDSTicket } from '../kds/entities/kds-ticket.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private dataSource: DataSource,
    private kdsGateway: KDSGateway,
    private ordersService: OrdersService,
  ) {}

  private emitPaymentSettlement(
    dispatchedTickets: KDSTicket[],
    paidOrderId: string | null,
    paidOrderTotal: number | null,
  ) {
    this.ordersService.emitDispatchTickets(dispatchedTickets);
    if (paidOrderId && paidOrderTotal !== null) {
      this.kdsGateway.emitOrderPaid({ orderId: paidOrderId, total: paidOrderTotal });
    }
  }

  private async settleOrderIfFullyPaidInTransaction(
    manager: EntityManager,
    orderId: string,
  ): Promise<{ dispatchedTickets: KDSTicket[]; paidOrderId: string | null; paidOrderTotal: number | null }> {
    const order = await manager.findOne(Order, { where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const payments = await manager.find(Payment, {
      where: { orderId, status: 'CONFIRMED' },
    });
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    if (totalPaid < Number(order.total) || order.status === 'Paid') {
      return {
        dispatchedTickets: [],
        paidOrderId: null,
        paidOrderTotal: null,
      };
    }

    const dispatch = await this.ordersService.dispatchPendingItemsInTransaction(manager, order.id);
    await manager.update(Order, order.id, { status: 'Paid' });
    await this.ordersService.syncPaidOrderTableStateInTransaction(manager, order.id);

    return {
      dispatchedTickets: dispatch.tickets,
      paidOrderId: order.id,
      paidOrderTotal: Number(order.total),
    };
  }

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'Paid') throw new BadRequestException('Order already paid');
    if (order.status === 'Voided') throw new BadRequestException('Order is voided');

    const payment = this.paymentRepo.create({
      orderId: dto.orderId,
      method: dto.method as any,
      amount: dto.amount,
      status: 'PENDING',
    });
    return this.paymentRepo.save(payment);
  }

  async confirm(id: string, dto: ConfirmPaymentDto, user: User): Promise<Payment> {
    let dispatchedTickets: KDSTicket[] = [];
    let paidOrderId: string | null = null;
    let paidOrderTotal: number | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, { where: { id } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== 'PENDING') {
        throw new BadRequestException('Payment is not in PENDING state');
      }

      await manager.update(Payment, id, {
        status: 'CONFIRMED',
        upiRef: dto.upiRef,
        confirmedBy: user.id,
      });

      const settlement = await this.settleOrderIfFullyPaidInTransaction(manager, payment.orderId);
      dispatchedTickets = settlement.dispatchedTickets;
      paidOrderId = settlement.paidOrderId;
      paidOrderTotal = settlement.paidOrderTotal;

      const updatedPayment = await manager.findOne(Payment, { where: { id } });
      if (!updatedPayment) throw new NotFoundException('Payment not found after update');
      return updatedPayment;
    });

    this.emitPaymentSettlement(dispatchedTickets, paidOrderId, paidOrderTotal);

    return result;
  }

  async handleUpiWebhook(upiRef: string, status: 'CONFIRMED' | 'FAILED') {
    let dispatchedTickets: KDSTicket[] = [];
    let paidOrderId: string | null = null;
    let paidOrderTotal: number | null = null;

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, { where: { upiRef } });
      if (!payment) return;

      await manager.update(Payment, payment.id, { status });

      if (status !== 'CONFIRMED') return;

      const settlement = await this.settleOrderIfFullyPaidInTransaction(manager, payment.orderId);
      dispatchedTickets = settlement.dispatchedTickets;
      paidOrderId = settlement.paidOrderId;
      paidOrderTotal = settlement.paidOrderTotal;
    });

    this.emitPaymentSettlement(dispatchedTickets, paidOrderId, paidOrderTotal);
  }

  async createAndConfirmCustomerPayment(input: {
    orderId: string;
    method: PaymentMethod;
    upiRef?: string;
  }): Promise<Payment> {
    let dispatchedTickets: KDSTicket[] = [];
    let paidOrderId: string | null = null;
    let paidOrderTotal: number | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: input.orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'Paid') throw new BadRequestException('Order already paid');
      if (order.status === 'Voided') throw new BadRequestException('Order is voided');

      const payment = await manager.save(Payment, manager.create(Payment, {
        orderId: input.orderId,
        method: input.method,
        amount: Number(order.total),
        status: 'PENDING',
      }));

      await manager.update(Payment, payment.id, {
        status: 'CONFIRMED',
        upiRef: input.method === 'UPI' ? (input.upiRef?.trim() || undefined) : undefined,
      });

      const settlement = await this.settleOrderIfFullyPaidInTransaction(manager, input.orderId);
      dispatchedTickets = settlement.dispatchedTickets;
      paidOrderId = settlement.paidOrderId;
      paidOrderTotal = settlement.paidOrderTotal;

      const updatedPayment = await manager.findOne(Payment, { where: { id: payment.id } });
      if (!updatedPayment) throw new NotFoundException('Payment not found after update');
      return updatedPayment;
    });

    this.emitPaymentSettlement(dispatchedTickets, paidOrderId, paidOrderTotal);
    return result;
  }

  async refund(id: string, dto: RefundPaymentDto, user: User): Promise<Payment> {
    if (user.role !== 'Admin') throw new ForbiddenException('Only Admin can process refunds');

    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed payments can be refunded');
    }

    await this.paymentRepo.update(id, { status: 'REFUNDED', refundReason: dto.reason });

    await this.auditRepo.save(
      this.auditRepo.create({
        actorId: user.id,
        action: 'REFUND',
        entityType: 'Payment',
        entityId: id,
        metaBefore: { status: 'CONFIRMED' },
        metaAfter: { status: 'REFUNDED', reason: dto.reason },
      }),
    );

    const result = await this.paymentRepo.findOne({ where: { id } });
    if (!result) throw new NotFoundException('Payment not found');
    return result;
  }

  async calculateSplit(orderId: string, dto: SplitBillDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (dto.mode === 'EVEN') {
      const partySize = dto.partySize ?? 2;
      const perPerson = Number(order.total) / partySize;
      return {
        mode: 'EVEN',
        total: order.total,
        partySize,
        perPerson: Math.round(perPerson * 100) / 100,
      };
    }

    const itemMap = Object.fromEntries(order.items.map((i) => [i.id, i]));
    const splits = (dto.splits ?? []).map((split) => {
      const items = split.itemIds.map((id) => itemMap[id]).filter(Boolean);
      const subtotal = items.reduce((s, i) => {
        const modsTotal = (i.modifiers ?? []).reduce((m, mod) => m + mod.price, 0);
        return s + (i.unitPrice + modsTotal) * i.quantity;
      }, 0);
      const tax = subtotal * 0.05;
      return { guestIndex: split.guestIndex, items: items.map((i) => i.productName), subtotal, tax, total: subtotal + tax };
    });

    return { mode: 'BY_ITEM', splits };
  }

  async getByOrder(orderId: string) {
    return this.paymentRepo.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }
}
