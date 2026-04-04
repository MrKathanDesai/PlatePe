import {
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
import { IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

class AddItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

class UpdateTipDto {
  @IsNumber()
  tip: number;
}

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  findAll(
    @Query('tableId') tableId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll({ tableId, sessionId, status: status as any });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/send')
  sendToKitchen(@Param('id') id: string) {
    return this.ordersService.sendToKitchen(id);
  }

  @Post(':id/items')
  addItems(@Param('id') id: string, @Body() dto: AddItemsDto) {
    return this.ordersService.addItems(id, dto.items);
  }

  @Patch(':id/items/:itemId')
  updateItemQty(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
  ) {
    return this.ordersService.updateItemQuantity(id, itemId, body.quantity);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(id, itemId);
  }

  @Patch(':id/items/:itemId/void')
  voidItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: VoidItemDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.voidItem(id, itemId, dto, user);
  }

  @Patch(':id/discount')
  applyDiscount(
    @Param('id') id: string,
    @Body() dto: ApplyDiscountDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.applyDiscount(id, dto, user);
  }

  @Patch(':id/tip')
  updateTip(@Param('id') id: string, @Body() dto: UpdateTipDto) {
    return this.ordersService.updateTip(id, dto.tip);
  }

  @Patch(':id/void')
  voidOrder(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.voidOrder(id, user);
  }

  @Delete(':id')
  cancelOrder(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.cancelOrder(id, user);
  }
}
