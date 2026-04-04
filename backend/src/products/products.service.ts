import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { Modifier } from './entities/modifier.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { inferCategoryStation } from './utils/category-station';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Modifier) private modifierRepo: Repository<Modifier>,
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
