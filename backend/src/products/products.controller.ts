import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateModifierDto } from './dto/create-modifier.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Categories
  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Get('categories')
  findAllCategories() {
    return this.productsService.findAllCategories();
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  // Modifiers
  @Post('modifiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  createModifier(@Body() dto: CreateModifierDto) {
    return this.productsService.createModifier(dto);
  }

  @Get('modifiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAllModifiers() {
    return this.productsService.findAllModifiers();
  }

  // Products
  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post('products/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  importProducts(@Body() dto: ImportProductsDto) {
    if (!dto.rows?.length) throw new BadRequestException('Import requires at least one row');
    return this.productsService.importProducts(dto);
  }

  @Get('products')
  findAll(@Query('categoryId') categoryId?: string) {
    return this.productsService.findAll(categoryId);
  }

  @Get('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.productsService.update(id, dto);
  }

  @Patch('products/:id/86')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  toggle86(@Param('id') id: string) {
    return this.productsService.toggle86(id);
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }
}
