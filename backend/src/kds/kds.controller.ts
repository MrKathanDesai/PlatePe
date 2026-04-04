import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { KDSService } from './kds.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { KDSStation } from '../products/entities/category.entity';

@Controller('kds')
@UseGuards(JwtAuthGuard)
export class KDSController {
  constructor(private readonly kdsService: KDSService) {}

  @Get('tickets')
  getActiveTickets(@Query('station') station?: KDSStation) {
    return this.kdsService.getActiveTickets(station);
  }

  @Get('tickets/all')
  getAllTickets(@Query('station') station?: KDSStation) {
    return this.kdsService.getAllTickets(station);
  }

  @Patch('tickets/:id/stage')
  advanceStage(@Param('id') id: string) {
    return this.kdsService.advanceStage(id);
  }
}
