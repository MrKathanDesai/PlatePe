import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
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

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private toDbTimestamp(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const pad = (part: number, size = 2) => String(part).padStart(size, '0');
    return [
      `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
      `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}.${pad(parsed.getMilliseconds(), 3)}`,
    ].join(' ');
  }

  private joinConfirmedPayments<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, orderAlias: string, joinAlias = 'paid') {
    return query.innerJoin(
      (subQuery) => subQuery
        .from(Payment, 'payment')
        .select('payment.orderId', 'orderId')
        .addSelect('MAX(payment.updatedAt)', 'paidAt')
        .where("payment.status = 'CONFIRMED'")
        .groupBy('payment.orderId'),
      joinAlias,
      `${joinAlias}."orderId" = ${orderAlias}.id`,
    );
  }

  async getDailySummary(from: string, to: string) {
    const fromTs = this.toDbTimestamp(from);
    const toTs = this.toDbTimestamp(to);

    const result = await this.joinConfirmedPayments(
      this.orderRepo.createQueryBuilder('o'),
      'o',
    )
      .select([
        'DATE(paid."paidAt") AS "date"',
        'COUNT(o.id) AS "orderCount"',
        'SUM(o.subtotal) AS "subtotal"',
        'SUM(o.tax) AS "tax"',
        'SUM(o.discount) AS "discount"',
        'SUM(o.tip) AS "tip"',
        'SUM(o.total) AS "total"',
      ])
      .where("o.status = 'Paid'")
      .andWhere('paid."paidAt" >= :from', { from: fromTs })
      .andWhere('paid."paidAt" <= :to', { to: toTs })
      .groupBy('DATE(paid."paidAt")')
      .orderBy('DATE(paid."paidAt")', 'DESC')
      .getRawMany();

    return result.map((row: Record<string, unknown>) => ({
      date: this.toIsoString(row.date),
      orderCount: this.toNumber(row.orderCount ?? row.ordercount),
      subtotal: this.toNumber(row.subtotal),
      tax: this.toNumber(row.tax),
      discount: this.toNumber(row.discount),
      tip: this.toNumber(row.tip),
      total: this.toNumber(row.total),
    }));
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
      .select(['p.method AS "method"', 'SUM(p.amount) AS "total"'])
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
      paymentBreakdown: payments.map((payment: Record<string, unknown>) => ({
        method: String(payment.method ?? ''),
        total: this.toNumber(payment.total),
      })),
      discrepancy: session?.discrepancy != null ? this.toNumber(session.discrepancy) : null,
    };
  }

  async getProductPerformance(from: string, to: string) {
    const fromTs = this.toDbTimestamp(from);
    const toTs = this.toDbTimestamp(to);

    const modifierRevenueSql = `
      COALESCE(
        (
          SELECT SUM((modifier->>'price')::numeric)
          FROM jsonb_array_elements(i.modifiers) AS modifier
        ),
        0
      )
    `;

    const result = await this.joinConfirmedPayments(
      this.itemRepo.createQueryBuilder('i')
      .innerJoin('orders', 'o', 'o.id = i.orderId')
      ,
      'o',
    )
      .where("o.status = 'Paid'")
      .andWhere("i.status != 'Voided'")
      .andWhere('paid."paidAt" >= :from', { from: fromTs })
      .andWhere('paid."paidAt" <= :to', { to: toTs })
      .select([
        'i.productId AS "productId"',
        'i.productName AS "name"',
        'SUM(i.quantity) AS "totalQty"',
        `SUM((i.unitPrice + ${modifierRevenueSql}) * i.quantity) AS "revenue"`,
      ])
      .groupBy('i.productId, i.productName')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return result.map((row: Record<string, unknown>) => ({
      productId: String(row.productId ?? row.productid ?? ''),
      name: String(row.name ?? ''),
      totalQty: this.toNumber(row.totalQty ?? row.totalqty),
      revenue: this.toNumber(row.revenue),
    }));
  }

  async getHourlyHeatmap(from: string, to: string) {
    const fromTs = this.toDbTimestamp(from);
    const toTs = this.toDbTimestamp(to);

    const dayOfWeekExpr = 'EXTRACT(DOW FROM paid."paidAt")';
    const slotExpr = 'FLOOR(EXTRACT(HOUR FROM paid."paidAt") * 2 + EXTRACT(MINUTE FROM paid."paidAt") / 30)';

    const result = await this.joinConfirmedPayments(
      this.orderRepo.createQueryBuilder('o'),
      'o',
    )
      .where("o.status = 'Paid'")
      .andWhere('paid."paidAt" >= :from', { from: fromTs })
      .andWhere('paid."paidAt" <= :to', { to: toTs })
      .select([
        `${dayOfWeekExpr} AS "dayOfWeek"`,
        `${slotExpr} AS "slot"`,
        'COUNT(o.id) AS "orderCount"',
        'SUM(o.total) AS "revenue"',
      ])
      .groupBy(dayOfWeekExpr)
      .addGroupBy(slotExpr)
      .orderBy(dayOfWeekExpr, 'ASC')
      .addOrderBy(slotExpr, 'ASC')
      .getRawMany();

    return result.map((row: Record<string, unknown>) => ({
      dayOfWeek: this.toNumber(row.dayOfWeek ?? row.dayofweek),
      slot: this.toNumber(row.slot),
      orderCount: this.toNumber(row.orderCount ?? row.ordercount),
      revenue: this.toNumber(row.revenue),
    }));
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
    const fromTs = this.toDbTimestamp(from);
    const toTs = this.toDbTimestamp(to);

    // Seat-to-pay: time from first item sent to payment confirmed
    const result = await this.joinConfirmedPayments(
      this.orderRepo.createQueryBuilder('o'),
      'o',
    )
      .where("o.status = 'Paid'")
      .andWhere('o.tableId IS NOT NULL')
      .andWhere('paid."paidAt" >= :from', { from: fromTs })
      .andWhere('paid."paidAt" <= :to', { to: toTs })
      .select([
        'o.tableId AS "tableId"',
        'COUNT(o.id) AS "turnovers"',
        'AVG(EXTRACT(EPOCH FROM (paid."paidAt" - o.createdAt)) / 60) AS "avgMinutes"',
      ])
      .groupBy('o.tableId')
      .orderBy('turnovers', 'DESC')
      .getRawMany();

    return result.map((row: Record<string, unknown>) => ({
      tableId: String(row.tableId ?? row.tableid ?? ''),
      turnovers: this.toNumber(row.turnovers),
      avgMinutes: this.toNumber(row.avgMinutes ?? row.avgminutes),
    }));
  }
}
