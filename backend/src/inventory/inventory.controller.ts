import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InventoryService, AdjustStockDto } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

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

  @Post('adjust')
  @Roles('Admin')
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: User) {
    return this.inventoryService.adjustStock(dto, user.id);
  }
}
