import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { Terminal } from './entities/terminal.entity';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private sessionRepo: Repository<Session>,
    @InjectRepository(Terminal) private terminalRepo: Repository<Terminal>,
  ) {}

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

    return Promise.all(terminals.map((terminal) => this.syncTerminalLock(terminal)));
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
