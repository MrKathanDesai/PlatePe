import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KDSTicket, TicketStage } from './entities/kds-ticket.entity';
import type { KDSStation } from '../products/entities/category.entity';
import { KDSGateway } from './kds.gateway';

@Injectable()
export class KDSService {
  constructor(
    @InjectRepository(KDSTicket) private ticketRepo: Repository<KDSTicket>,
    private gateway: KDSGateway,
  ) {}

  async getActiveTickets(station?: KDSStation) {
    const baseWhere = station
      ? [{ stage: 'TO_COOK' as const, station }, { stage: 'PREPARING' as const, station }]
      : [{ stage: 'TO_COOK' as const }, { stage: 'PREPARING' as const }];

    const tickets = await this.ticketRepo.find({
      where: baseWhere,
      order: { receivedAt: 'ASC' },
    });

    return {
      TO_COOK: tickets.filter((t) => t.stage === 'TO_COOK'),
      PREPARING: tickets.filter((t) => t.stage === 'PREPARING'),
    };
  }

  async getAllTickets(station?: KDSStation) {
    const where = station ? { station } : undefined;
    return this.ticketRepo.find({
      where,
      order: { receivedAt: 'DESC' },
      take: 100,
    });
  }

  async advanceStage(id: string): Promise<KDSTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const stageMap: Record<TicketStage, TicketStage | null> = {
      TO_COOK: 'PREPARING',
      PREPARING: 'DONE',
      DONE: null,
    };

    const nextStage = stageMap[ticket.stage];
    if (!nextStage) throw new BadRequestException('Ticket is already completed');

    const update: Partial<KDSTicket> = { stage: nextStage };
    if (nextStage === 'PREPARING') update.startedAt = new Date();
    if (nextStage === 'DONE') update.completedAt = new Date();

    await this.ticketRepo.update(id, update);

    const updated = await this.ticketRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Ticket not found after update');
    this.gateway.emitStageUpdate(updated);
    return updated;
  }
}
