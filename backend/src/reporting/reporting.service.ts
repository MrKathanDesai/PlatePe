import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Session } from '../sessions/entities/session.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderLineItem) private itemRepo: Repository<OrderLineItem>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async getDailySummary(from: string, to: string) {
    const result = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        "DATE(o.createdAt) AS date",
        'COUNT(o.id) AS orderCount',
        'SUM(o.subtotal) AS subtotal',
        'SUM(o.tax) AS tax',
        'SUM(o.discount) AS discount',
        'SUM(o.tip) AS tip',
        'SUM(o.total) AS total',
      ])
      .where("o.status = 'Paid'")
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .groupBy("DATE(o.createdAt)")
      .orderBy("DATE(o.createdAt)", 'DESC')
      .getRawMany();

    return result;
  }

  async getSessionSummary(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['user', 'terminal'],
    });

    const orders = await this.orderRepo.find({
      where: { sessionId },
      relations: ['items'],
    });

    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('orders', 'o', 'o.id = p.orderId')
      .where('o.sessionId = :sessionId', { sessionId })
      .andWhere("p.status = 'CONFIRMED'")
      .select(['p.method AS method', 'SUM(p.amount) AS total'])
      .groupBy('p.method')
      .getRawMany();

    const totalRevenue = orders
      .filter((o) => o.status === 'Paid')
      .reduce((s, o) => s + Number(o.total), 0);

    return {
      session,
      totalOrders: orders.length,
      paidOrders: orders.filter((o) => o.status === 'Paid').length,
      voidedOrders: orders.filter((o) => o.status === 'Voided').length,
      totalRevenue,
      paymentBreakdown: payments,
      discrepancy: session?.discrepancy,
    };
  }

  async getProductPerformance(from: string, to: string) {
    return this.itemRepo
      .createQueryBuilder('i')
      .innerJoin('orders', 'o', 'o.id = i.orderId')
      .where("o.status = 'Paid'")
      .andWhere("i.status != 'Voided'")
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .select([
        'i.productId AS productId',
        'i.productName AS name',
        'SUM(i.quantity) AS totalQty',
        'SUM(i.unitPrice * i.quantity) AS revenue',
      ])
      .groupBy('i.productId, i.productName')
      .orderBy('revenue', 'DESC')
      .getRawMany();
  }

  async getHourlyHeatmap(from: string, to: string) {
    return this.orderRepo
      .createQueryBuilder('o')
      .where("o.status = 'Paid'")
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .select([
        'EXTRACT(DOW FROM o.createdAt) AS dayOfWeek',
        'FLOOR(EXTRACT(HOUR FROM o.createdAt) * 2 + EXTRACT(MINUTE FROM o.createdAt) / 30) AS slot',
        'COUNT(o.id) AS orderCount',
        'SUM(o.total) AS revenue',
      ])
      .groupBy('dayOfWeek, slot')
      .orderBy('dayOfWeek', 'ASC')
      .addOrderBy('slot', 'ASC')
      .getRawMany();
  }

  async getAuditTrail(query: { from?: string; to?: string; action?: string }) {
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .limit(1000);

    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.from) qb.andWhere('log.timestamp >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.timestamp <= :to', { to: query.to });

    return qb.getMany();
  }

  async getTableTurnover(from: string, to: string) {
    // Seat-to-pay: time from first item sent to payment confirmed
    return this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('payments', 'p', "p.orderId = o.id AND p.status = 'CONFIRMED'")
      .where("o.status = 'Paid'")
      .andWhere('o.tableId IS NOT NULL')
      .andWhere('o.createdAt >= :from', { from })
      .andWhere('o.createdAt <= :to', { to })
      .select([
        'o.tableId AS tableId',
        'COUNT(o.id) AS turnovers',
        'AVG(EXTRACT(EPOCH FROM (p.updatedAt - o.createdAt)) / 60) AS avgMinutes',
      ])
      .groupBy('o.tableId')
      .orderBy('turnovers', 'DESC')
      .getRawMany();
  }
}
