import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrderTokensService } from './order-tokens.service';
import { CreateOrderTokenDto, UpdateOrderTokenStatusDto } from './dto/create-order-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('order-tokens')
export class OrderTokensController {
  constructor(private readonly orderTokensService: OrderTokensService) {}

  @Get('public/:publicCode')
  getPublicStatus(@Param('publicCode') publicCode: string) {
    return this.orderTokensService.getPublicStatus(publicCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager', 'Cashier', 'Server')
  @Get()
  findAll(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.orderTokensService.findAll({ sessionId, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager', 'Cashier', 'Server')
  @Post('issue')
  issue(@Body() dto: CreateOrderTokenDto) {
    return this.orderTokensService.issueForOrder(dto.orderId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager', 'Cashier', 'Server')
  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.orderTokensService.findByOrder(orderId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager', 'Cashier', 'Server')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderTokenStatusDto) {
    return this.orderTokensService.updateStatus(id, dto.status ?? 'ISSUED');
  }
}
