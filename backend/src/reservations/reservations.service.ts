import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationTableAssignment } from './entities/reservation-table-assignment.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { AssignReservationDto } from './dto/assign-reservation.dto';
import { Table } from '../tables/entities/table.entity';
import { User } from '../auth/entities/user.entity';

const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'SEATED'] as const;

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation) private reservationRepo: Repository<Reservation>,
    @InjectRepository(ReservationTableAssignment) private assignmentRepo: Repository<ReservationTableAssignment>,
    @InjectRepository(Table) private tableRepo: Repository<Table>,
  ) {}

  private toDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid datetime`);
    }
    return parsed;
  }

  private validateWindow(startsAt: Date, endsAt: Date) {
    if (startsAt >= endsAt) {
      throw new BadRequestException('Reservation end time must be after the start time');
    }

    const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
    if (durationMinutes < 15) {
      throw new BadRequestException('Reservation must be at least 15 minutes long');
    }
  }

  private async loadReservationOrThrow(id: string) {
    const reservation = await this.reservationRepo.findOne({
      where: { id },
      relations: ['assignments', 'assignments.table', 'createdByUser'],
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  private async assertTablesExist(tableIds: string[]) {
    if (tableIds.length === 0) return [];

    const tables = await this.tableRepo.find({
      where: { id: In(tableIds), isActive: true },
    });
    if (tables.length !== tableIds.length) {
      throw new BadRequestException('One or more assigned tables were not found');
    }
    return tables;
  }

  private async assertNoOverlap(
    reservationId: string | null,
    tableIds: string[],
    startsAt: Date,
    endsAt: Date,
  ) {
    if (tableIds.length === 0) return;

    const overlap = await this.assignmentRepo
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.reservation', 'reservation')
      .innerJoinAndSelect('assignment.table', 'table')
      .where('assignment.tableId IN (:...tableIds)', { tableIds })
      .andWhere('reservation.status IN (:...statuses)', { statuses: ACTIVE_RESERVATION_STATUSES })
      .andWhere('reservation.startsAt < :endsAt', { endsAt })
      .andWhere('reservation.endsAt > :startsAt', { startsAt })
      .andWhere(reservationId ? 'reservation.id != :reservationId' : '1=1', { reservationId: reservationId ?? undefined })
      .getOne();

    if (overlap) {
      throw new BadRequestException(`Table ${overlap.table.number} is already reserved during that time`);
    }
  }

  private async replaceAssignments(
    reservationId: string,
    startsAt: Date,
    endsAt: Date,
    dto: AssignReservationDto,
  ) {
    const tableIds = Array.from(new Set(dto.tableIds));
    if (dto.primaryTableId && !tableIds.includes(dto.primaryTableId)) {
      throw new BadRequestException('Primary table must be part of the assigned tables');
    }

    await this.assertTablesExist(tableIds);
    await this.assertNoOverlap(reservationId, tableIds, startsAt, endsAt);
    await this.assignmentRepo.delete({ reservationId });

    if (tableIds.length === 0) return;

    const assignments = tableIds.map((tableId, index) => this.assignmentRepo.create({
      reservationId,
      tableId,
      isPrimary: dto.primaryTableId
        ? dto.primaryTableId === tableId
        : index === 0,
    }));
    await this.assignmentRepo.save(assignments);
  }

  async create(dto: CreateReservationDto, user: User) {
    const startsAt = this.toDate(dto.startsAt, 'startsAt');
    const endsAt = this.toDate(dto.endsAt, 'endsAt');
    this.validateWindow(startsAt, endsAt);

    const reservation = this.reservationRepo.create({
      guestName: dto.guestName.trim(),
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      partySize: dto.partySize,
      startsAt,
      endsAt,
      status: dto.status ?? 'CONFIRMED',
      notes: dto.notes?.trim() || null,
      channel: dto.channel ?? 'PHONE',
      createdByUserId: user.id,
    });
    const saved = await this.reservationRepo.save(reservation);

    if ((dto.tableIds?.length ?? 0) > 0) {
      await this.replaceAssignments(saved.id, startsAt, endsAt, {
        tableIds: dto.tableIds ?? [],
        primaryTableId: dto.primaryTableId,
      });
    }

    return this.loadReservationOrThrow(saved.id);
  }

  async findAll(query: { from?: string; to?: string; status?: string }) {
    const qb = this.reservationRepo.createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.assignments', 'assignment')
      .leftJoinAndSelect('assignment.table', 'table')
      .leftJoinAndSelect('reservation.createdByUser', 'createdByUser')
      .orderBy('reservation.startsAt', 'ASC')
      .addOrderBy('reservation.createdAt', 'ASC');

    if (query.status) {
      qb.andWhere('reservation.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('reservation.endsAt >= :from', { from: this.toDate(query.from, 'from') });
    }
    if (query.to) {
      qb.andWhere('reservation.startsAt <= :to', { to: this.toDate(query.to, 'to') });
    }

    return qb.getMany();
  }

  findOne(id: string) {
    return this.loadReservationOrThrow(id);
  }

  async update(id: string, dto: UpdateReservationDto) {
    const reservation = await this.loadReservationOrThrow(id);

    const startsAt = dto.startsAt ? this.toDate(dto.startsAt, 'startsAt') : reservation.startsAt;
    const endsAt = dto.endsAt ? this.toDate(dto.endsAt, 'endsAt') : reservation.endsAt;
    this.validateWindow(startsAt, endsAt);

    if ((dto.status === 'CANCELLED' || dto.status === 'NO_SHOW') && reservation.status === 'SEATED') {
      throw new BadRequestException('Seated reservations cannot be cancelled directly');
    }

    reservation.guestName = dto.guestName?.trim() || reservation.guestName;
    reservation.phone = dto.phone !== undefined ? (dto.phone?.trim() || null) : reservation.phone;
    reservation.email = dto.email !== undefined ? (dto.email?.trim() || null) : reservation.email;
    reservation.partySize = dto.partySize ?? reservation.partySize;
    reservation.startsAt = startsAt;
    reservation.endsAt = endsAt;
    reservation.notes = dto.notes !== undefined ? (dto.notes?.trim() || null) : reservation.notes;
    reservation.channel = dto.channel ?? reservation.channel;
    reservation.status = dto.status ?? reservation.status;

    if (reservation.assignments.length > 0) {
      await this.assertNoOverlap(
        reservation.id,
        reservation.assignments.map((assignment) => assignment.tableId),
        startsAt,
        endsAt,
      );
    }

    await this.reservationRepo.save(reservation);
    return this.loadReservationOrThrow(id);
  }

  async assign(id: string, dto: AssignReservationDto) {
    const reservation = await this.loadReservationOrThrow(id);
    if (reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED' || reservation.status === 'NO_SHOW') {
      throw new BadRequestException('This reservation can no longer be assigned');
    }

    await this.replaceAssignments(id, reservation.startsAt, reservation.endsAt, dto);
    return this.loadReservationOrThrow(id);
  }

  async seat(id: string) {
    const reservation = await this.loadReservationOrThrow(id);
    if (reservation.status === 'CANCELLED' || reservation.status === 'NO_SHOW' || reservation.status === 'COMPLETED') {
      throw new BadRequestException('This reservation cannot be seated');
    }
    if ((reservation.assignments?.length ?? 0) === 0) {
      throw new BadRequestException('Assign at least one table before seating the reservation');
    }

    reservation.status = 'SEATED';
    reservation.seatedAt = new Date();
    await this.reservationRepo.save(reservation);
    return this.loadReservationOrThrow(id);
  }

  async cancel(id: string) {
    const reservation = await this.loadReservationOrThrow(id);
    if (reservation.status === 'COMPLETED') {
      throw new BadRequestException('Completed reservations cannot be cancelled');
    }

    reservation.status = 'CANCELLED';
    reservation.cancelledAt = new Date();
    await this.reservationRepo.save(reservation);
    return this.loadReservationOrThrow(id);
  }

  async markNoShow(id: string) {
    const reservation = await this.loadReservationOrThrow(id);
    if (reservation.status === 'SEATED' || reservation.status === 'COMPLETED') {
      throw new BadRequestException('Seated or completed reservations cannot be marked as no-show');
    }

    reservation.status = 'NO_SHOW';
    reservation.cancelledAt = new Date();
    await this.reservationRepo.save(reservation);
    return this.loadReservationOrThrow(id);
  }

  async complete(id: string) {
    const reservation = await this.loadReservationOrThrow(id);
    if (reservation.status !== 'SEATED') {
      throw new BadRequestException('Only seated reservations can be completed');
    }

    reservation.status = 'COMPLETED';
    reservation.completedAt = new Date();
    await this.reservationRepo.save(reservation);
    return this.loadReservationOrThrow(id);
  }
}
