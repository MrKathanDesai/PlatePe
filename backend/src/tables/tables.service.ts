import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table) private tableRepo: Repository<Table>,
  ) {}

  async create(dto: CreateTableDto) {
    const table = this.tableRepo.create({ seats: 4, ...dto });
    return this.tableRepo.save(table);
  }

  async findAll() {
    return this.tableRepo.find({
      where: { isActive: true },
      order: { number: 'ASC' },
    });
  }

  async findOne(id: string) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async updateStatus(id: string, status: TableStatus, currentOrderId?: string, currentBill?: number) {
    const update: Record<string, unknown> = { status };
    if (status === 'Occupied') {
      update.occupiedSince = new Date();
      if (currentOrderId) update.currentOrderId = currentOrderId;
    }
    if (status === 'Available') {
      update.occupiedSince = null;
      update.currentOrderId = null;
      update.currentBill = null;
    }
    if (currentBill !== undefined) update.currentBill = currentBill;

    await this.tableRepo.update(id, update as any);
    return this.findOne(id);
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

    return this.findOne(toId);
  }

  async deactivate(id: string) {
    await this.tableRepo.update(id, { isActive: false });
    return { message: 'Table removed' };
  }
}
