import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metaBefore?: Record<string, unknown>;
    metaAfter?: Record<string, unknown>;
  }) {
    return this.auditRepo.save(this.auditRepo.create(data));
  }

  async findAll(query: { entityType?: string; actorId?: string; from?: string; to?: string }) {
    const qb = this.auditRepo.createQueryBuilder('log').orderBy('log.timestamp', 'DESC').limit(500);

    if (query.entityType) qb.andWhere('log.entityType = :entityType', { entityType: query.entityType });
    if (query.actorId) qb.andWhere('log.actorId = :actorId', { actorId: query.actorId });
    if (query.from) qb.andWhere('log.timestamp >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.timestamp <= :to', { to: query.to });

    return qb.getMany();
  }
}
