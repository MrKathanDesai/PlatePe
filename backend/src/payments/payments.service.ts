import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { Table } from '../tables/entities/table.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import {
  CreatePaymentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  SplitBillDto,
} from './dto/create-payment.dto';
import { User } from '../auth/entities/user.entity';
import { KDSGateway } from '../kds/kds.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderLineItem) private itemRepo: Repository<OrderLineItem>,
    @InjectRepository(Table) private tableRepo: Repository<Table>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private dataSource: DataSource,
    private kdsGateway: KDSGateway,
  ) {}

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
    return this.dataSource.transaction(async (manager) => {
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

      const order = await manager.findOne(Order, { where: { id: payment.orderId } });
      if (!order) throw new NotFoundException('Order not found');

      const payments = await manager.find(Payment, {
        where: { orderId: payment.orderId, status: 'CONFIRMED' },
      });
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

      if (totalPaid >= Number(order.total)) {
        await manager.update(Order, order.id, { status: 'Paid' });
        if (order.tableId) {
          await manager.update(Table, order.tableId, {
            status: 'Available',
            occupiedSince: null,
            currentOrderId: null,
            currentBill: null,
          } as any);
        }
        this.kdsGateway.emitOrderPaid({ orderId: order.id, total: Number(order.total) });
      }

      const result = await manager.findOne(Payment, { where: { id } });
      if (!result) throw new NotFoundException('Payment not found after update');
      return result;
    });
  }

  async handleUpiWebhook(upiRef: string, status: 'CONFIRMED' | 'FAILED') {
    const payment = await this.paymentRepo.findOne({ where: { upiRef } });
    if (!payment) return;

    await this.paymentRepo.update(payment.id, { status });

    if (status === 'CONFIRMED') {
      const order = await this.orderRepo.findOne({ where: { id: payment.orderId } });
      if (!order) return;

      const payments = await this.paymentRepo.find({
        where: { orderId: payment.orderId, status: 'CONFIRMED' },
      });
      const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

      if (totalPaid >= Number(order.total)) {
        await this.orderRepo.update(order.id, { status: 'Paid' });
        if (order.tableId) {
          await this.tableRepo.update(order.tableId, {
            status: 'Available',
            occupiedSince: null,
            currentOrderId: null,
            currentBill: null,
          } as any);
        }
      }
    }
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
