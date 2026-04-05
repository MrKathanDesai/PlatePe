import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { Terminal } from './entities/terminal.entity';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { User } from '../auth/entities/user.entity';
import { Order } from '../orders/entities/order.entity';

type SessionSalesSummary = {
  salesTotal: number;
  orderCount: number;
};

type TerminalSessionSnapshot = {
  id: string;
  userId: string;
  userName: string | null;
  status: Session['status'];
  openedAt: Date;
  openingBalance: number;
};

type TerminalClosedSessionSnapshot = TerminalSessionSnapshot & {
  closedAt: Date | null;
  closingBalance: number | null;
  discrepancy: number | null;
  salesTotal: number;
  orderCount: number;
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(Terminal) private terminalRepo: Repository<Terminal>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private buildSessionSnapshot(session: Session): TerminalSessionSnapshot {
    return {
      id: session.id,
      userId: session.userId,
      userName: session.user?.name ?? null,
      status: session.status,
      openedAt: session.startTime,
      openingBalance: this.toNumber(session.openingBalance),
    };
  }

  private buildClosedSessionSnapshot(
    session: Session,
    sales: SessionSalesSummary,
  ): TerminalClosedSessionSnapshot {
    return {
      ...this.buildSessionSnapshot(session),
      closedAt: session.endTime ?? null,
      closingBalance: session.closingBalance != null ? this.toNumber(session.closingBalance) : null,
      discrepancy: session.discrepancy != null ? this.toNumber(session.discrepancy) : null,
      salesTotal: sales.salesTotal,
      orderCount: sales.orderCount,
    };
  }

  private async findActiveSessionForTerminal(terminalId: string) {
    return this.sessionRepo.findOne({
      where: { terminalId, status: 'ACTIVE' },
      relations: ['terminal', 'user'],
    });
  }

  private async syncTerminalLock(terminal: Terminal) {
    const activeSession = await this.findActiveSessionForTerminal(terminal.id);

    if (!activeSession) {
      if (terminal.isLocked || terminal.lockedByUserId) {
        await this.terminalRepo.update(terminal.id, {
          isLocked: false,
          lockedByUserId: null,
        });
      }

      return {
        ...terminal,
        isLocked: false,
        lockedByUserId: null,
        lockedByUserName: null,
      };
    }

    if (!terminal.isLocked || terminal.lockedByUserId !== activeSession.userId) {
      await this.terminalRepo.update(terminal.id, {
        isLocked: true,
        lockedByUserId: activeSession.userId,
      });
    }

    return {
      ...terminal,
      isLocked: true,
      lockedByUserId: activeSession.userId,
      lockedByUserName: activeSession.user?.name ?? null,
    };
  }

  async createTerminal(dto: CreateTerminalDto) {
    const terminal = this.terminalRepo.create(dto);
    return this.terminalRepo.save(terminal);
  }

  async findAllTerminals() {
    const terminals = await this.terminalRepo.find({
      order: { createdAt: 'ASC' },
    });

    if (terminals.length === 0) return [];

    const terminalIds = terminals.map((terminal) => terminal.id);
    const sessions = await this.sessionRepo.find({
      where: { terminalId: In(terminalIds) },
      relations: ['user'],
      order: { startTime: 'DESC' },
    });

    const sessionIds = sessions.map((session) => session.id);
    const salesBySessionId = new Map<string, SessionSalesSummary>();

    if (sessionIds.length > 0) {
      const salesRows = await this.orderRepo.createQueryBuilder('order')
        .select('order.sessionId', 'sessionId')
        .addSelect('COUNT(order.id)', 'orderCount')
        .addSelect('COALESCE(SUM(order.total), 0)', 'salesTotal')
        .where('order.sessionId IN (:...sessionIds)', { sessionIds })
        .andWhere("order.status = 'Paid'")
        .groupBy('order.sessionId')
        .getRawMany();

      for (const row of salesRows) {
        salesBySessionId.set(String(row.sessionId), {
          salesTotal: this.toNumber(row.salesTotal),
          orderCount: this.toNumber(row.orderCount),
        });
      }
    }

    const sessionsByTerminalId = new Map<string, Session[]>();
    for (const session of sessions) {
      const existing = sessionsByTerminalId.get(session.terminalId);
      if (existing) existing.push(session);
      else sessionsByTerminalId.set(session.terminalId, [session]);
    }

    return Promise.all(terminals.map(async (terminal) => {
      const synced = await this.syncTerminalLock(terminal);
      const terminalSessions = sessionsByTerminalId.get(terminal.id) ?? [];
      const lastOpenedSession = terminalSessions[0]
        ? this.buildSessionSnapshot(terminalSessions[0])
        : null;
      const activeSession = terminalSessions.find((session) => session.status === 'ACTIVE');
      const lastClosedSession = terminalSessions.find((session) => session.status === 'CLOSED');

      return {
        ...synced,
        activeSession: activeSession ? this.buildSessionSnapshot(activeSession) : null,
        lastOpenedSession,
        lastClosedSession: lastClosedSession
          ? this.buildClosedSessionSnapshot(
            lastClosedSession,
            salesBySessionId.get(lastClosedSession.id) ?? { salesTotal: 0, orderCount: 0 },
          )
          : null,
      };
    }));
  }

  async openSession(dto: OpenSessionDto, user: User): Promise<Session> {
    const terminal = await this.terminalRepo.findOne({ where: { id: dto.terminalId } });
    if (!terminal) throw new NotFoundException('Terminal not found');

    const existingActive = await this.sessionRepo.findOne({
      where: { userId: user.id, status: 'ACTIVE' },
      relations: ['terminal', 'user'],
    });

    if (existingActive?.terminalId === dto.terminalId) {
      await this.terminalRepo.update(terminal.id, {
        isLocked: true,
        lockedByUserId: user.id,
      });
      return existingActive;
    }

    const activeSessionOnTerminal = await this.findActiveSessionForTerminal(dto.terminalId);

    if (activeSessionOnTerminal && activeSessionOnTerminal.userId !== user.id) {
      throw new ConflictException(
        `This terminal is already in use by ${activeSessionOnTerminal.user?.name ?? 'another user'}`,
      );
    }

    if (activeSessionOnTerminal?.userId === user.id) {
      await this.terminalRepo.update(terminal.id, {
        isLocked: true,
        lockedByUserId: user.id,
      });
      return activeSessionOnTerminal;
    }

    await this.syncTerminalLock(terminal);

    if (existingActive) {
      const terminalLabel = existingActive.terminal
        ? `${existingActive.terminal.name}${existingActive.terminal.location ? ` (${existingActive.terminal.location})` : ''}`
        : 'another terminal';
      throw new ConflictException(`You already have an active session on ${terminalLabel}`);
    }

    await this.terminalRepo.update(terminal.id, {
      isLocked: true,
      lockedByUserId: user.id,
    });

    const session = this.sessionRepo.create({
      userId: user.id,
      terminalId: dto.terminalId,
      openingBalance: dto.openingBalance,
      status: 'ACTIVE',
    });

    return this.sessionRepo.save(session);
  }

  async getActiveSession(userId: string) {
    return this.sessionRepo.findOne({
      where: { userId, status: 'ACTIVE' },
      relations: ['terminal', 'user'],
    });
  }

  async closeSession(id: string, dto: CloseSessionDto, userId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id, userId, status: 'ACTIVE' },
    });
    if (!session) throw new NotFoundException('Active session not found');

    const discrepancy = Number(dto.closingBalance) - Number(session.openingBalance);

    await this.sessionRepo.update(id, {
      closingBalance: dto.closingBalance,
      discrepancy,
      status: 'CLOSED',
      endTime: new Date(),
    });

    await this.terminalRepo.update(session.terminalId, {
      isLocked: false,
      lockedByUserId: null,
    });

    return this.sessionRepo.findOne({ where: { id } });
  }

  async getSession(id: string) {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['terminal', 'user'],
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getSessionHistory() {
    return this.sessionRepo.find({
      relations: ['terminal', 'user'],
      order: { startTime: 'DESC' },
      take: 50,
    });
  }
}
