import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { Modifier } from './entities/modifier.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { inferCategoryStation } from './utils/category-station';
import { ImportProductsDto, ImportProductRowDto } from './dto/import-products.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Modifier) private modifierRepo: Repository<Modifier>,
    private dataSource: DataSource,
  ) {}

  // --- Categories ---
  async createCategory(dto: CreateCategoryDto) {
    const cat = this.categoryRepo.create({
      ...dto,
      station: dto.station ?? inferCategoryStation(dto.name),
    });
    return this.categoryRepo.save(cat);
  }

  async findAllCategories() {
    return this.categoryRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    await this.categoryRepo.update(id, dto);
    return this.categoryRepo.findOneByOrFail({ id });
  }

  // --- Modifiers ---
  async createModifier(dto: CreateModifierDto) {
    const mod = this.modifierRepo.create(dto);
    return this.modifierRepo.save(mod);
  }

  async findAllModifiers() {
    return this.modifierRepo.find({ order: { name: 'ASC' } });
  }

  // --- Products ---
  async create(dto: CreateProductDto) {
    const { modifierIds, ...rest } = dto;
    const product = this.productRepo.create(rest as any) as unknown as Product;

    if (modifierIds?.length) {
      product.modifiers = await this.modifierRepo.findBy({ id: In(modifierIds) });
    }

    return this.productRepo.save(product);
  }

  async findAll(categoryId?: string) {
    return this.productRepo.find({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      relations: ['category', 'modifiers'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['category', 'modifiers'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    const { modifierIds, ...rest } = dto;
    await this.productRepo.update(id, rest as any);

    if (modifierIds !== undefined) {
      const product = await this.findOne(id);
      product.modifiers = modifierIds.length
        ? await this.modifierRepo.findBy({ id: In(modifierIds) })
        : [];
      await this.productRepo.save(product);
    }

    return this.findOne(id);
  }

  async importProducts(dto: ImportProductsDto) {
    return this.dataSource.transaction(async (manager) => {
      let created = 0;
      let updated = 0;
      let categoriesCreated = 0;

      for (const row of dto.rows) {
        const category = await this.resolveCategoryForImport(manager.getRepository(Category), row);
        if (category?.createdNow) categoriesCreated += 1;

        const existing = await this.findExistingProductForImport(manager.getRepository(Product), row);
        const payload: Partial<Product> = {
          code: row.code?.trim() || (existing?.code ?? null),
          name: row.name.trim(),
          description: row.description?.trim() || null,
          categoryId: category?.entity.id ?? null,
          price: row.price,
          costPrice: row.costPrice ?? 0,
          taxRate: row.taxRate ?? 0,
          image: row.imageUrl?.trim() || null,
          sendToKitchen: row.sendToKds ?? true,
          isActive: row.isActive ?? true,
          is86d: row.isAvailable === undefined ? false : !row.isAvailable,
          lowStockThreshold: row.lowStockAlert ?? 10,
          stockQty: row.stockQty ?? (row.stockTracked ? 0 : (existing?.stockQty ?? -1)),
        };

        if (existing) {
          await manager.getRepository(Product).update(existing.id, payload);
          updated += 1;
          continue;
        }

        await manager.getRepository(Product).save(
          manager.getRepository(Product).create(payload),
        );
        created += 1;
      }

      return {
        rows: dto.rows.length,
        created,
        updated,
        categoriesCreated,
      };
    });
  }

  private async findExistingProductForImport(repo: Repository<Product>, row: ImportProductRowDto) {
    if (row.code?.trim()) {
      const byCode = await repo.findOne({ where: { code: row.code.trim() } });
      if (byCode) return byCode;
    }

    return repo.findOne({ where: { name: ILike(row.name.trim()) } });
  }

  private async resolveCategoryForImport(
    repo: Repository<Category>,
    row: ImportProductRowDto,
  ): Promise<{ entity: Category; createdNow: boolean } | null> {
    if (!row.category?.trim()) return null;

    const existing = await repo.findOne({ where: { name: ILike(row.category.trim()) } });
    if (existing) {
      const station = this.normalizeStation(row.kdsStation);
      if (station && existing.station !== station) {
        await repo.update(existing.id, { station });
        existing.station = station;
      }
      return { entity: existing, createdNow: false };
    }

    const created = await repo.save(
      repo.create({
        name: row.category.trim(),
        station: this.normalizeStation(row.kdsStation) ?? inferCategoryStation(row.category.trim()),
      }),
    );
    return { entity: created, createdNow: true };
  }

  private normalizeStation(station?: string) {
    if (!station) return undefined;
    const upper = station.trim().toUpperCase();
    if (upper === 'KITCHEN' || upper === 'BREWBAR') return upper;
    return undefined;
  }

  async toggle86(id: string) {
    const product = await this.findOne(id);
    await this.productRepo.update(id, { is86d: !product.is86d });
    return { ...product, is86d: !product.is86d };
  }

  async deactivate(id: string) {
    await this.productRepo.update(id, { isActive: false });
    return { message: 'Product deactivated' };
  }
}
