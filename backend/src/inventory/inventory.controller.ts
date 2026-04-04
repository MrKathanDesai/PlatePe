import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import {
  AdjustStockDto,
  ImportIngredientsDto,
  ImportRecipeLinesDto,
  ImportRecipeModifierEffectsDto,
} from './dto/import-inventory.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getInventory() {
    return this.inventoryService.getInventory();
  }

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get('ingredients')
  getIngredients() {
    return this.inventoryService.getIngredients();
  }

  @Get('recipes')
  getRecipes(@Query('productId') productId?: string) {
    return this.inventoryService.getRecipes(productId);
  }

  @Get('modifier-effects')
  getModifierEffects(@Query('productId') productId?: string) {
    return this.inventoryService.getModifierEffects(productId);
  }

  @Get('transactions')
  @Roles('Admin', 'Manager')
  getTransactions(@Query('ingredientId') ingredientId?: string) {
    return this.inventoryService.getTransactions(ingredientId);
  }

  @Post('ingredients')
  @Roles('Admin')
  createIngredient(@Body() dto: CreateIngredientDto, @CurrentUser() user: User) {
    return this.inventoryService.createIngredient(dto, user.id);
  }

  @Post('adjust')
  @Roles('Admin')
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: User) {
    return this.inventoryService.adjustStock(dto, user.id);
  }

  @Post('import/ingredients')
  @Roles('Admin')
  importIngredients(@Body() dto: ImportIngredientsDto, @CurrentUser() user: User) {
    return this.inventoryService.importIngredients(dto, user.id);
  }

  @Post('import/recipes')
  @Roles('Admin')
  importRecipes(@Body() dto: ImportRecipeLinesDto, @CurrentUser() user: User) {
    return this.inventoryService.importRecipeLines(dto, user.id);
  }

  @Post('import/modifier-effects')
  @Roles('Admin')
  importModifierEffects(@Body() dto: ImportRecipeModifierEffectsDto, @CurrentUser() user: User) {
    return this.inventoryService.importModifierEffects(dto, user.id);
  }
}
