import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

export class AdjustStockDto {
  productId: string;
  adjustment: number;
  reason?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async getInventory() {
    return this.productRepo.find({
      where: { isActive: true },
      select: ['id', 'name', 'stockQty', 'lowStockThreshold', 'is86d'],
      order: { name: 'ASC' },
    });
  }

  async getLowStock() {
    return this.productRepo
      .createQueryBuilder('p')
      .where('p.isActive = true')
      .andWhere('p.stockQty >= 0')
      .andWhere('p.stockQty <= p.lowStockThreshold')
      .select(['p.id', 'p.name', 'p.stockQty', 'p.lowStockThreshold'])
      .getMany();
  }

  async adjustStock(dto: AdjustStockDto, actorId: string) {
    const product = await this.productRepo.findOne({ where: { id: dto.productId } });

    const before = product?.stockQty;
    await this.productRepo.increment({ id: dto.productId }, 'stockQty', dto.adjustment);
    const updated = await this.productRepo.findOne({ where: { id: dto.productId } });

    await this.auditRepo.save(
      this.auditRepo.create({
        actorId,
        action: 'STOCK_ADJUST',
        entityType: 'Product',
        entityId: dto.productId,
        metaBefore: { stockQty: before },
        metaAfter: { stockQty: updated?.stockQty, reason: dto.reason },
      }),
    );

    return updated;
  }
}
