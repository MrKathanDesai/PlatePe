import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Floor } from './entities/floor.entity';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { Table } from '../tables/entities/table.entity';

@Injectable()
export class FloorsService {
  constructor(
    @InjectRepository(Floor) private floorRepo: Repository<Floor>,
    @InjectRepository(Table) private tableRepo: Repository<Table>,
  ) {}

  async create(dto: CreateFloorDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Floor name is required');

    const existing = await this.floorRepo.findOne({ where: { name } });
    if (existing) throw new BadRequestException('A floor with this name already exists');

    const floor = this.floorRepo.create({
      name,
      sortOrder: dto.sortOrder ?? 0,
      width: dto.width ?? 1200,
      height: dto.height ?? 800,
      isActive: dto.isActive ?? true,
    });

    return this.floorRepo.save(floor);
  }

  findAll() {
    return this.floorRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateFloorDto) {
    const floor = await this.floorRepo.findOne({ where: { id } });
    if (!floor) throw new NotFoundException('Floor not found');

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Floor name is required');

      const duplicate = await this.floorRepo.findOne({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('A floor with this name already exists');
      }

      floor.name = name;
    }

    if (dto.sortOrder !== undefined) floor.sortOrder = dto.sortOrder;
    if (dto.width !== undefined) floor.width = dto.width;
    if (dto.height !== undefined) floor.height = dto.height;
    if (dto.isActive !== undefined) floor.isActive = dto.isActive;

    return this.floorRepo.save(floor);
  }

  async remove(id: string) {
    const floor = await this.floorRepo.findOne({ where: { id } });
    if (!floor) throw new NotFoundException('Floor not found');

    const assignedTables = await this.tableRepo.count({
      where: { floorId: id, isActive: true },
    });
    if (assignedTables > 0) {
      throw new BadRequestException('Move or remove tables on this floor before deleting it');
    }

    await this.floorRepo.delete(id);
    return { message: 'Floor removed' };
  }
}
