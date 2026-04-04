import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { Product } from '../products/entities/product.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Ingredient } from './entities/ingredient.entity';
import { ProductRecipeLine } from './entities/product-recipe-line.entity';
import { RecipeModifierEffect } from './entities/recipe-modifier-effect.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      AuditLog,
      Ingredient,
      ProductRecipeLine,
      RecipeModifierEffect,
      InventoryTransaction,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
