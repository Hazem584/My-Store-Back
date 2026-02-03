import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  daily(@Query('date') date?: string) {
    return this.reportsService.getDailyReport(date);
  }

  @Get('monthly')
  monthly(@Query('month') month?: string) {
    return this.reportsService.getMonthlyReport(month);
  }
}
