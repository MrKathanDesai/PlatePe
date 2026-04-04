import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from './entities/discount.entity';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(Discount) private discountRepo: Repository<Discount>,
  ) {}

  async create(dto: CreateDiscountDto) {
    const discount = this.discountRepo.create(dto as any);
    return this.discountRepo.save(discount);
  }

  async findAll() {
    return this.discountRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async update(id: string, dto: Partial<CreateDiscountDto>) {
    const discount = await this.discountRepo.findOne({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    await this.discountRepo.update(id, dto as any);
    return this.discountRepo.findOne({ where: { id } });
  }

  async deactivate(id: string) {
    await this.discountRepo.update(id, { isActive: false });
    return { message: 'Discount deactivated' };
  }
}
