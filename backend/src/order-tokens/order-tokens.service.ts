import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OrderToken, OrderTokenStatus } from './entities/order-token.entity';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class OrderTokensService {
  constructor(
    @InjectRepository(OrderToken) private orderTokenRepo: Repository<OrderToken>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  private generatePublicCode() {
    return randomBytes(5).toString('hex').toUpperCase();
  }

  async issueForOrder(orderId: string, manager?: EntityManager) {
    const tokenRepo = manager ? manager.getRepository(OrderToken) : this.orderTokenRepo;
    const orderRepo = manager ? manager.getRepository(Order) : this.orderRepo;

    const existing = await tokenRepo.findOne({ where: { orderId } });
    if (existing) return existing;

    const order = await orderRepo.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) throw new NotFoundException('Order not found');
    if (order.source !== 'TOKEN') {
      throw new BadRequestException('Only token-based orders can receive an order token');
    }

    const latestToken = await tokenRepo.findOne({
      where: { sessionId: order.sessionId },
      order: { displayNumber: 'DESC' },
    });

    let publicCode = this.generatePublicCode();
    while (await tokenRepo.findOne({ where: { publicCode } })) {
      publicCode = this.generatePublicCode();
    }

    const token = tokenRepo.create({
      orderId: order.id,
      sessionId: order.sessionId,
      displayNumber: (latestToken?.displayNumber ?? 0) + 1,
      publicCode,
      status: 'ISSUED',
    });

    return tokenRepo.save(token);
  }

  findAll(query: { sessionId?: string; status?: string }) {
    const where: Record<string, string> = {};
    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.status) where.status = query.status;

    return this.orderTokenRepo.find({
      where,
      relations: ['order'],
      order: { issuedAt: 'DESC' },
      take: 100,
    });
  }

  async findByOrder(orderId: string) {
    const token = await this.orderTokenRepo.findOne({
      where: { orderId },
      relations: ['order'],
    });
    if (!token) throw new NotFoundException('Token not found for order');
    return token;
  }

  async getPublicStatus(publicCode: string) {
    const token = await this.orderTokenRepo.findOne({
      where: { publicCode },
      relations: ['order', 'order.items'],
    });
    if (!token) throw new NotFoundException('Order token not found');

    return {
      id: token.id,
      displayNumber: token.displayNumber,
      publicCode: token.publicCode,
      status: token.status,
      issuedAt: token.issuedAt,
      readyAt: token.readyAt,
      completedAt: token.completedAt,
      order: {
        id: token.order.id,
        orderNumber: token.order.orderNumber,
        status: token.order.status,
        total: token.order.total,
        items: token.order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          status: item.status,
        })),
      },
    };
  }

  async updateStatus(id: string, status: OrderTokenStatus) {
    const token = await this.orderTokenRepo.findOne({ where: { id } });
    if (!token) throw new NotFoundException('Order token not found');

    token.status = status;
    if (status === 'READY' && !token.readyAt) token.readyAt = new Date();
    if (status === 'COMPLETED' && !token.completedAt) token.completedAt = new Date();
    return this.orderTokenRepo.save(token);
  }
}
