import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('daily')
  getDailySummary(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const endOfTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    return this.reportingService.getDailySummary(
      from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to ?? endOfTomorrow,
    );
  }

  @Get('session/:id')
  getSessionSummary(@Param('id') id: string) {
    return this.reportingService.getSessionSummary(id);
  }

  @Get('products')
  getProductPerformance(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const endOfTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    return this.reportingService.getProductPerformance(
      from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to ?? endOfTomorrow,
    );
  }

  @Get('hourly-heatmap')
  getHourlyHeatmap(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const endOfTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    return this.reportingService.getHourlyHeatmap(
      from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to ?? endOfTomorrow,
    );
  }

  @Get('audit')
  getAuditTrail(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('action') action?: string,
  ) {
    return this.reportingService.getAuditTrail({ from, to, action });
  }

  @Get('table-turnover')
  getTableTurnover(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const endOfTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    return this.reportingService.getTableTurnover(
      from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to ?? endOfTomorrow,
    );
  }
}
