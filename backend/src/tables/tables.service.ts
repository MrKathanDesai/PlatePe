import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { Order } from '../orders/entities/order.entity';
import { UpdateTableDto } from './dto/update-table.dto';
import { Floor } from '../floors/entities/floor.entity';

function normalizeTableNumber(number: string) {
  return number.trim().toUpperCase().replace(/\s+/g, '');
}

function getTableNumberRank(number: string) {
  const match = /^T?(\d+)$/.exec(number);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private tableRepo: Repository<Table>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Floor) private floorRepo: Repository<Floor>,
  ) {}

  private sortTables(tables: Table[]) {
    return tables.sort((left, right) => {
      const leftRank = getTableNumberRank(left.number);
      const rightRank = getTableNumberRank(right.number);

      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.number.localeCompare(right.number, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  private normalizeOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private async validateFloorId(floorId?: string | null) {
    const normalized = this.normalizeOptionalString(floorId);
    if (!normalized) return null;

    const floor = await this.floorRepo.findOne({
      where: { id: normalized, isActive: true },
    });
    if (!floor) throw new BadRequestException('Floor not found');
    return floor.id;
  }

  async create(dto: CreateTableDto) {
    const number = normalizeTableNumber(dto.number);
    if (!number) throw new BadRequestException('Table number is required');

    const floorId = await this.validateFloorId(dto.floorId);

    const existing = await this.tableRepo.findOne({ where: { number } });
    if (existing?.isActive) {
      throw new BadRequestException(`Table ${number} already exists`);
    }

    if (existing) {
      existing.isActive = true;
      existing.number = number;
      existing.seats = dto.seats ?? existing.seats ?? 4;
      existing.floorId = floorId;
      existing.x = dto.x ?? existing.x ?? null;
      existing.y = dto.y ?? existing.y ?? null;
      existing.width = dto.width ?? existing.width ?? 140;
      existing.height = dto.height ?? existing.height ?? 110;
      existing.shape = dto.shape ?? existing.shape ?? 'rectangle';
      existing.rotation = dto.rotation ?? existing.rotation ?? 0;
      existing.status = 'Available';
      existing.currentBill = null;
      existing.attentionType = null;
      existing.attentionRequestedAt = null;
      existing.currentOrderId = null;
      existing.occupiedSince = null;
      return this.tableRepo.save(existing);
    }

    const table = this.tableRepo.create({
      seats: 4,
      ...dto,
      number,
      floorId,
      x: dto.x ?? null,
      y: dto.y ?? null,
      width: dto.width ?? 140,
      height: dto.height ?? 110,
      shape: dto.shape ?? 'rectangle',
      rotation: dto.rotation ?? 0,
    });
    return this.tableRepo.save(table);
  }

  async findAll() {
    const tables = await this.tableRepo.find({
      where: {
        isActive: true,
      },
      relations: ['floor'],
    });

    return this.sortTables(tables);
  }

  async findOne(id: string) {
    const table = await this.tableRepo.findOne({ where: { id }, relations: ['floor'] });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async update(id: string, dto: UpdateTableDto) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');

    if (dto.number !== undefined) {
      const number = normalizeTableNumber(dto.number);
      if (!number) throw new BadRequestException('Table number is required');

      const existing = await this.tableRepo.findOne({ where: { number } });
      if (existing && existing.id !== id && existing.isActive) {
        throw new BadRequestException(`Table ${number} already exists`);
      }

      table.number = number;
    }

    if (dto.seats !== undefined) table.seats = dto.seats;
    if (dto.floorId !== undefined) table.floorId = await this.validateFloorId(dto.floorId);
    if (dto.x !== undefined) table.x = dto.x;
    if (dto.y !== undefined) table.y = dto.y;
    if (dto.width !== undefined) table.width = dto.width;
    if (dto.height !== undefined) table.height = dto.height;
    if (dto.shape !== undefined) table.shape = this.normalizeOptionalString(dto.shape);
    if (dto.rotation !== undefined) table.rotation = dto.rotation;

    return this.tableRepo.save(table);
  }

  async updateStatus(id: string, status: TableStatus, currentOrderId?: string, currentBill?: number) {
    return this.tableRepo.manager.transaction(async (manager) => {
      const table = await manager.findOne(Table, { where: { id } });
      if (!table) throw new NotFoundException('Table not found');

      const update: Record<string, unknown> = { status };
      if (status === 'Occupied') {
        update.occupiedSince = new Date();
        if (currentOrderId) update.currentOrderId = currentOrderId;
      }
      if (status === 'Available') {
        update.occupiedSince = null;
        update.currentOrderId = null;
        update.currentBill = null;
        update.attentionType = null;
        update.attentionRequestedAt = null;

        // Manually freeing a table should also detach any still-open tickets from it,
        // otherwise the floor plan clears while the order remains ghost-linked.
        await manager.update(
          Order,
          { tableId: id, status: In(['Open', 'Sent'] as const) },
          { tableId: null } as any,
        );
      }
      if (currentBill !== undefined) update.currentBill = currentBill;

      await manager.update(Table, id, update as any);

      const updated = await manager.findOne(Table, { where: { id } });
      if (!updated) throw new NotFoundException('Table not found');
      return updated;
    });
  }

  async transferOrder(fromId: string, toId: string, orderId: string) {
    const toTable = await this.findOne(toId);
    if (toTable.status !== 'Available') {
      throw new BadRequestException('Destination table is not available');
    }

    await this.tableRepo.update(fromId, {
      status: 'Available',
      occupiedSince: null,
      currentOrderId: null,
      currentBill: null,
      attentionType: null,
      attentionRequestedAt: null,
    } as any);

    await this.tableRepo.update(toId, {
      status: 'Occupied',
      occupiedSince: new Date(),
      currentOrderId: orderId,
      attentionType: null,
      attentionRequestedAt: null,
    } as any);

    // Update the order's tableId so payment clearing logic targets the correct table
    await this.orderRepo.update(orderId, { tableId: toId });

    return this.findOne(toId);
  }

  async deactivate(id: string) {
    await this.tableRepo.update(id, { isActive: false });
    return { message: 'Table removed' };
  }
}
