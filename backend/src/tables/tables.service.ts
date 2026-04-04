import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { Order } from '../orders/entities/order.entity';

const SUPPORTED_TABLE_NUMBERS = Array.from({ length: 10 }, (_, index) => `T${index + 1}`);

function normalizeTableNumber(number: string) {
  return number.trim().toUpperCase().replace(/\s+/g, '');
}

function getTableNumberRank(number: string) {
  const match = /^T([1-9]|10)$/.exec(number);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private tableRepo: Repository<Table>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  async create(dto: CreateTableDto) {
    const number = normalizeTableNumber(dto.number);
    if (!SUPPORTED_TABLE_NUMBERS.includes(number)) {
      throw new BadRequestException('Table number must be between T1 and T10');
    }

    const existing = await this.tableRepo.findOne({ where: { number } });
    if (existing?.isActive) {
      throw new BadRequestException(`Table ${number} already exists`);
    }

    if (existing) {
      existing.isActive = true;
      existing.number = number;
      existing.seats = dto.seats ?? existing.seats ?? 4;
      existing.floorId = dto.floorId?.trim() || null;
      existing.status = 'Available';
      existing.currentBill = null;
      existing.currentOrderId = null;
      existing.occupiedSince = null;
      return this.tableRepo.save(existing);
    }

    const table = this.tableRepo.create({
      seats: 4,
      ...dto,
      number,
      floorId: dto.floorId?.trim() || null,
    });
    return this.tableRepo.save(table);
  }

  async findAll() {
    const tables = await this.tableRepo.find({
      where: {
        isActive: true,
        number: In(SUPPORTED_TABLE_NUMBERS),
      },
    });

    return tables.sort((left, right) => getTableNumberRank(left.number) - getTableNumberRank(right.number));
  }

  async findOne(id: string) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');
    return table;
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
    } as any);

    await this.tableRepo.update(toId, {
      status: 'Occupied',
      occupiedSince: new Date(),
      currentOrderId: orderId,
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
