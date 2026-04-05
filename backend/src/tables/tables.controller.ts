import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsString, IsOptional, IsIn, IsNumber } from 'class-validator';
import type { TableStatus } from './entities/table.entity';

class UpdateStatusDto {
  @IsIn(['Available', 'Occupied', 'Reserved', 'Needs Attention', 'Unpaid'])
  status: TableStatus;

  @IsOptional()
  @IsString()
  currentOrderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentBill?: number;
}

class TransferDto {
  @IsString() toTableId: string;
  @IsString() orderId: string;
}

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  @Get()
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  update(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.tablesService.updateStatus(id, dto.status, dto.currentOrderId, dto.currentBill);
  }

  @Patch(':id/transfer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  transfer(@Param('id') fromId: string, @Body() dto: TransferDto) {
    return this.tablesService.transferOrder(fromId, dto.toTableId, dto.orderId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  deactivate(@Param('id') id: string) {
    return this.tablesService.deactivate(id);
  }
}
