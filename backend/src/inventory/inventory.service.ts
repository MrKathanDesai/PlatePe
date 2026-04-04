import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  ILike,
  In,
  Repository,
} from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Ingredient } from './entities/ingredient.entity';
import { ProductRecipeLine } from './entities/product-recipe-line.entity';
import { RecipeModifierEffect } from './entities/recipe-modifier-effect.entity';
import {
  InventoryTransaction,
  InventoryTransactionType,
} from './entities/inventory-transaction.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import {
  AdjustStockDto,
  ImportIngredientsDto,
  ImportRecipeLineRowDto,
  ImportRecipeLinesDto,
  ImportRecipeModifierEffectsDto,
  ImportRecipeModifierEffectRowDto,
} from './dto/import-inventory.dto';
import { OrderLineItem } from '../orders/entities/order-line-item.entity';

type OrderModifier = { id?: string; name: string; price?: number };

interface InventoryRequirementSource {
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  modifiers: OrderModifier[];
}

export interface IngredientRequirement {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  baseUnit: string;
  quantity: number;
  sources: InventoryRequirementSource[];
}

export interface ResolvedIngredientRequirements {
  recipeBackedItemIds: string[];
  requirements: IngredientRequirement[];
}

interface InventoryMutationOptions {
  actorId?: string | null;
  type: InventoryTransactionType;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Ingredient) private ingredientRepo: Repository<Ingredient>,
    @InjectRepository(ProductRecipeLine) private recipeRepo: Repository<ProductRecipeLine>,
    @InjectRepository(RecipeModifierEffect)
    private modifierEffectRepo: Repository<RecipeModifierEffect>,
    @InjectRepository(InventoryTransaction)
    private transactionRepo: Repository<InventoryTransaction>,
    private dataSource: DataSource,
  ) {}

  async createIngredient(dto: CreateIngredientDto, actorId?: string) {
    const existing = await this.ingredientRepo.findOne({ where: { code: dto.code.trim() } });
    if (existing) throw new BadRequestException(`Ingredient code ${dto.code} already exists`);

    const ingredient = await this.ingredientRepo.save(
      this.ingredientRepo.create({
        code: dto.code.trim(),
        name: dto.name.trim(),
        category: dto.category?.trim() || null,
        baseUnit: dto.baseUnit.trim(),
        onHandQty: dto.onHandQty ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
        parLevel: dto.parLevel ?? 0,
        costPerUnit: dto.costPerUnit ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );

    await this.recordTransaction(this.dataSource.manager, ingredient, {
      actorId: actorId ?? null,
      type: 'IMPORT',
      reason: 'Ingredient created',
    }, Number(ingredient.onHandQty));

    return ingredient;
  }

  async getIngredients() {
    return this.ingredientRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async getRecipes(productId?: string) {
    return this.recipeRepo.find({
      where: productId ? { productId } : {},
      relations: ['product', 'ingredient'],
      order: { productId: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getModifierEffects(productId?: string) {
    return this.modifierEffectRepo.find({
      where: productId ? { productId } : {},
      relations: ['product', 'ingredient'],
      order: { productId: 'ASC', modifierName: 'ASC', createdAt: 'ASC' },
    });
  }

  async getTransactions(ingredientId?: string) {
    return this.transactionRepo.find({
      where: ingredientId ? { ingredientId } : {},
      order: { createdAt: 'DESC' },
      take: 250,
    });
  }

  async getInventory() {
    const items = await this.ingredientRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    return items.map((item) => ({
      id: item.id,
      productId: item.id,
      productName: item.name,
      unit: item.baseUnit,
      quantity: Number(item.onHandQty),
      lowStockThreshold: Number(item.lowStockThreshold),
      updatedAt: item.updatedAt,
    }));
  }

  async getLowStock() {
    const items = await this.ingredientRepo
      .createQueryBuilder('ingredient')
      .where('ingredient.isActive = true')
      .andWhere('ingredient.onHandQty <= ingredient.lowStockThreshold')
      .orderBy('ingredient.onHandQty', 'ASC')
      .addOrderBy('ingredient.name', 'ASC')
      .getMany();

    return items.map((item) => ({
      id: item.id,
      productId: item.id,
      productName: item.name,
      unit: item.baseUnit,
      quantity: Number(item.onHandQty),
      lowStockThreshold: Number(item.lowStockThreshold),
      updatedAt: item.updatedAt,
    }));
  }

  async adjustStock(dto: AdjustStockDto, actorId: string) {
    const ingredientId = dto.ingredientId ?? dto.productId;
    if (!ingredientId) {
      throw new BadRequestException('ingredientId is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const ingredient = await manager.getRepository(Ingredient).findOne({ where: { id: ingredientId } });
      if (!ingredient) throw new NotFoundException('Ingredient not found');

      const before = Number(ingredient.onHandQty);
      const after = before + dto.adjustment;
      await manager.getRepository(Ingredient).update(ingredient.id, { onHandQty: after });

      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create({
          actorId,
          action: 'STOCK_ADJUST',
          entityType: 'Ingredient',
          entityId: ingredient.id,
          metaBefore: { onHandQty: before },
          metaAfter: { onHandQty: after, reason: dto.reason ?? null },
        }),
      );

      await this.recordTransaction(
        manager,
        { ...ingredient, onHandQty: after } as Ingredient,
        {
          actorId,
          type: 'MANUAL_ADJUSTMENT',
          reason: dto.reason ?? 'Manual adjustment',
        },
        dto.adjustment,
      );

      return manager.getRepository(Ingredient).findOneByOrFail({ id: ingredient.id });
    });
  }

  async importIngredients(dto: ImportIngredientsDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      let created = 0;
      let updated = 0;

      for (const row of dto.rows) {
        const code = row.code.trim();
        const existing = await manager.getRepository(Ingredient).findOne({ where: { code } });
        const payload: Partial<Ingredient> = {
          code,
          name: row.name.trim(),
          category: row.category?.trim() || null,
          baseUnit: row.baseUnit.trim(),
          onHandQty: row.onHandQty ?? 0,
          lowStockThreshold: row.lowStockThreshold ?? 0,
          parLevel: row.parLevel ?? 0,
          costPerUnit: row.costPerUnit ?? 0,
          isActive: row.isActive ?? true,
        };

        if (existing) {
          const before = Number(existing.onHandQty);
          await manager.getRepository(Ingredient).update(existing.id, payload);
          const after = Number(payload.onHandQty ?? before);
          await this.recordTransaction(
            manager,
            { ...existing, ...payload, onHandQty: after } as Ingredient,
            {
              actorId,
              type: 'IMPORT',
              reason: 'Ingredient import update',
            },
            after - before,
          );
          updated += 1;
          continue;
        }

        const createdIngredient = await manager.getRepository(Ingredient).save(
          manager.getRepository(Ingredient).create(payload),
        );
        await this.recordTransaction(
          manager,
          createdIngredient,
          {
            actorId,
            type: 'IMPORT',
            reason: 'Ingredient import create',
          },
          Number(createdIngredient.onHandQty),
        );
        created += 1;
      }

      return { rows: dto.rows.length, created, updated };
    });
  }

  async importRecipeLines(dto: ImportRecipeLinesDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      let created = 0;
      let updated = 0;
      const affectedProductIds = new Set<string>();

      if (dto.replaceExisting) {
        const resolved = await this.resolveDistinctProducts(
          manager,
          dto.rows.map((row) => ({
            productId: row.productId,
            productCode: row.productCode,
            productName: row.productName,
          })),
        );
        resolved.forEach((product) => affectedProductIds.add(product.id));
        if (affectedProductIds.size > 0) {
          await manager.getRepository(ProductRecipeLine).delete({
            productId: In([...affectedProductIds]),
          });
        }
      }

      for (const row of dto.rows) {
        const product = await this.resolveProductReference(manager, row);
        const ingredient = await this.resolveIngredientByCode(manager, row.ingredientCode);
        this.validateUnit(row.unit, ingredient.baseUnit, ingredient.code);

        const existing = dto.replaceExisting
          ? null
          : await manager.getRepository(ProductRecipeLine).findOne({
              where: { productId: product.id, ingredientId: ingredient.id },
            });

        const payload: Partial<ProductRecipeLine> = {
          productId: product.id,
          ingredientId: ingredient.id,
          quantity: row.quantity,
          wastePct: row.wastePct ?? 0,
          sortOrder: row.sortOrder ?? 0,
        };

        if (existing) {
          await manager.getRepository(ProductRecipeLine).update(existing.id, payload);
          updated += 1;
        } else {
          await manager.getRepository(ProductRecipeLine).save(
            manager.getRepository(ProductRecipeLine).create(payload),
          );
          created += 1;
        }
      }

      const auditEntry: Partial<AuditLog> = {
        actorId,
        action: 'IMPORT_RECIPES',
        entityType: 'Recipe',
        entityId: undefined,
        metaBefore: undefined,
        metaAfter: {
          rows: dto.rows.length,
          replaceExisting: dto.replaceExisting ?? false,
          created,
          updated,
        },
      };
      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create(auditEntry),
      );

      return { rows: dto.rows.length, created, updated };
    });
  }

  async importModifierEffects(dto: ImportRecipeModifierEffectsDto, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      let created = 0;
      let updated = 0;
      const affectedProductIds = new Set<string>();

      if (dto.replaceExisting) {
        const resolved = await this.resolveDistinctProducts(
          manager,
          dto.rows.map((row) => ({
            productId: row.productId,
            productCode: row.productCode,
            productName: row.productName,
          })),
        );
        resolved.forEach((product) => affectedProductIds.add(product.id));
        if (affectedProductIds.size > 0) {
          await manager.getRepository(RecipeModifierEffect).delete({
            productId: In([...affectedProductIds]),
          });
        }
      }

      for (const row of dto.rows) {
        const product = await this.resolveProductReference(manager, row);
        const ingredient = await this.resolveIngredientByCode(manager, row.ingredientCode);
        this.validateUnit(row.unit, ingredient.baseUnit, ingredient.code);

        const normalizedName = row.modifierName.trim();
        const existing = dto.replaceExisting
          ? null
          : await manager.getRepository(RecipeModifierEffect).findOne({
              where: {
                productId: product.id,
                ingredientId: ingredient.id,
                modifierName: normalizedName,
              },
            });

        const payload: Partial<RecipeModifierEffect> = {
          productId: product.id,
          ingredientId: ingredient.id,
          modifierName: normalizedName,
          quantityDelta: row.quantityDelta,
        };

        if (existing) {
          await manager.getRepository(RecipeModifierEffect).update(existing.id, payload);
          updated += 1;
        } else {
          await manager.getRepository(RecipeModifierEffect).save(
            manager.getRepository(RecipeModifierEffect).create(payload),
          );
          created += 1;
        }
      }

      const auditEntry: Partial<AuditLog> = {
        actorId,
        action: 'IMPORT_RECIPE_MODIFIER_EFFECTS',
        entityType: 'RecipeModifierEffect',
        entityId: undefined,
        metaBefore: undefined,
        metaAfter: {
          rows: dto.rows.length,
          replaceExisting: dto.replaceExisting ?? false,
          created,
          updated,
        },
      };
      await manager.getRepository(AuditLog).save(
        manager.getRepository(AuditLog).create(auditEntry),
      );

      return { rows: dto.rows.length, created, updated };
    });
  }

  async resolveIngredientRequirements(
    manager: EntityManager,
    items: Pick<OrderLineItem, 'id' | 'productId' | 'productName' | 'quantity' | 'modifiers'>[],
  ): Promise<ResolvedIngredientRequirements> {
    if (!items.length) return { recipeBackedItemIds: [], requirements: [] };

    const productIds = [...new Set(items.map((item) => item.productId))];
    const recipeLines = await manager.getRepository(ProductRecipeLine).find({
      where: { productId: In(productIds) },
      relations: ['ingredient'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const modifierEffects = await manager.getRepository(RecipeModifierEffect).find({
      where: { productId: In(productIds) },
      relations: ['ingredient'],
      order: { createdAt: 'ASC' },
    });

    const recipeMap = new Map<string, ProductRecipeLine[]>();
    recipeLines.forEach((line) => {
      const current = recipeMap.get(line.productId) ?? [];
      current.push(line);
      recipeMap.set(line.productId, current);
    });

    const effectMap = new Map<string, RecipeModifierEffect[]>();
    modifierEffects.forEach((effect) => {
      const key = this.getEffectKey(effect.productId, effect.modifierName);
      const current = effectMap.get(key) ?? [];
      current.push(effect);
      effectMap.set(key, current);
    });

    const aggregated = new Map<string, IngredientRequirement>();
    const recipeBackedItemIds = new Set<string>();

    for (const item of items) {
      const baseLines = recipeMap.get(item.productId) ?? [];
      const matchedEffects = (item.modifiers ?? []).flatMap(
        (modifier) => effectMap.get(this.getEffectKey(item.productId, modifier.name)) ?? [],
      );

      if (!baseLines.length && !matchedEffects.length) continue;
      recipeBackedItemIds.add(item.id);

      for (const line of baseLines) {
        const wasteMultiplier = 1 + Number(line.wastePct ?? 0) / 100;
        const qty = Number(line.quantity) * item.quantity * wasteMultiplier;
        this.pushRequirement(aggregated, line.ingredient, qty, item);
      }

      for (const effect of matchedEffects) {
        const qty = Number(effect.quantityDelta) * item.quantity;
        this.pushRequirement(aggregated, effect.ingredient, qty, item);
      }
    }

    return {
      recipeBackedItemIds: [...recipeBackedItemIds],
      requirements: [...aggregated.values()].filter((requirement) => Math.abs(requirement.quantity) > 0.0001),
    };
  }

  async applyIngredientRequirements(
    manager: EntityManager,
    requirements: IngredientRequirement[],
    options: InventoryMutationOptions,
  ) {
    const actionable = requirements.filter((requirement) => Math.abs(requirement.quantity) > 0.0001);
    if (!actionable.length) return;

    const ingredientRepo = manager.getRepository(Ingredient);
    const ingredients = await ingredientRepo.findBy({
      id: In(actionable.map((requirement) => requirement.ingredientId)),
    });
    const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    const shortages: string[] = [];
    for (const requirement of actionable) {
      const ingredient = ingredientMap.get(requirement.ingredientId);
      if (!ingredient) {
        throw new NotFoundException(`Ingredient ${requirement.ingredientName} not found`);
      }
      if (requirement.quantity <= 0) continue;

      const onHand = Number(ingredient.onHandQty);
      if (onHand < requirement.quantity) {
        shortages.push(
          `${ingredient.name} (${onHand.toFixed(3)} ${ingredient.baseUnit} on hand, ${requirement.quantity.toFixed(3)} needed)`,
        );
      }
    }

    if (shortages.length) {
      throw new BadRequestException(`Insufficient ingredient stock: ${shortages.join('; ')}`);
    }

    for (const requirement of actionable) {
      const ingredient = ingredientMap.get(requirement.ingredientId);
      if (!ingredient) continue;

      const nextQty = Number(ingredient.onHandQty) - requirement.quantity;
      await ingredientRepo.update(ingredient.id, { onHandQty: nextQty });

      ingredient.onHandQty = nextQty;
      await this.recordTransaction(
        manager,
        ingredient,
        options,
        -requirement.quantity,
        {
          ingredientCode: requirement.ingredientCode,
          sources: requirement.sources,
          baseUnit: requirement.baseUnit,
        },
      );
    }
  }

  invertRequirements(requirements: IngredientRequirement[]) {
    return requirements.map((requirement) => ({
      ...requirement,
      quantity: requirement.quantity * -1,
    }));
  }

  private pushRequirement(
    store: Map<string, IngredientRequirement>,
    ingredient: Ingredient,
    quantity: number,
    item: Pick<OrderLineItem, 'id' | 'productId' | 'productName' | 'quantity' | 'modifiers'>,
  ) {
    const current = store.get(ingredient.id);
    if (current) {
      current.quantity += quantity;
      current.sources.push({
        orderItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        modifiers: (item.modifiers ?? []) as OrderModifier[],
      });
      return;
    }

    store.set(ingredient.id, {
      ingredientId: ingredient.id,
      ingredientCode: ingredient.code,
      ingredientName: ingredient.name,
      baseUnit: ingredient.baseUnit,
      quantity,
      sources: [{
        orderItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        modifiers: (item.modifiers ?? []) as OrderModifier[],
      }],
    });
  }

  private async recordTransaction(
    manager: EntityManager,
    ingredient: Ingredient,
    options: InventoryMutationOptions,
    quantityDelta: number,
    meta?: Record<string, unknown>,
  ) {
    await manager.getRepository(InventoryTransaction).save(
      manager.getRepository(InventoryTransaction).create({
        ingredientId: ingredient.id,
        type: options.type,
        quantityDelta,
        balanceAfter: Number(ingredient.onHandQty),
        referenceType: options.referenceType ?? null,
        referenceId: options.referenceId ?? null,
        actorId: options.actorId ?? null,
        reason: options.reason ?? null,
        meta: meta ?? null,
      }),
    );
  }

  private async resolveDistinctProducts(
    manager: EntityManager,
    rows: Array<{ productId?: string; productCode?: string; productName?: string }>,
  ) {
    const resolved: Product[] = [];
    for (const row of rows) {
      const product = await this.resolveProductReference(manager, row);
      if (!resolved.some((entry) => entry.id === product.id)) resolved.push(product);
    }
    return resolved;
  }

  private async resolveProductReference(
    manager: EntityManager,
    row: { productId?: string; productCode?: string; productName?: string },
  ) {
    const productRepo = manager.getRepository(Product);

    if (row.productId) {
      const byId = await productRepo.findOne({ where: { id: row.productId } });
      if (byId) return byId;
    }

    if (row.productCode?.trim()) {
      const byCode = await productRepo.findOne({ where: { code: row.productCode.trim() } });
      if (byCode) return byCode;
    }

    if (row.productName?.trim()) {
      const byName = await productRepo.findOne({ where: { name: ILike(row.productName.trim()) } });
      if (byName) return byName;
    }

    throw new BadRequestException(
      `Unable to resolve product reference: ${JSON.stringify({
        productId: row.productId ?? null,
        productCode: row.productCode ?? null,
        productName: row.productName ?? null,
      })}`,
    );
  }

  private async resolveIngredientByCode(manager: EntityManager, ingredientCode: string) {
    const ingredient = await manager.getRepository(Ingredient).findOne({
      where: { code: ingredientCode.trim() },
    });
    if (!ingredient) {
      throw new BadRequestException(`Ingredient ${ingredientCode} not found`);
    }
    return ingredient;
  }

  private validateUnit(unit: string | undefined, baseUnit: string, ingredientCode: string) {
    if (!unit?.trim()) return;
    if (unit.trim().toLowerCase() !== baseUnit.trim().toLowerCase()) {
      throw new BadRequestException(
        `Unit mismatch for ingredient ${ingredientCode}: expected ${baseUnit}, got ${unit}`,
      );
    }
  }

  private getEffectKey(productId: string, modifierName: string) {
    return `${productId}::${modifierName.trim().toLowerCase()}`;
  }
}
