import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateWorkDayDto } from './dto/create-work-day.dto';
import { QueryMonthlyWorkHoursDto } from './dto/query-monthly-work-hours.dto';
import { QueryWorkDayDto } from './dto/query-work-day.dto';
import { WorkHoursService } from './work-hours.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-hours')
export class WorkHoursController {
  constructor(private readonly workHoursService: WorkHoursService) {}

  @Post()
  @Roles(Role.OWNER, Role.CASHIER)
  upsert(@GetUser() user: JwtPayload, @Body() dto: CreateWorkDayDto) {
    return this.workHoursService.upsert(user.sub, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.CASHIER)
  getByDate(@GetUser() user: JwtPayload, @Query() query: QueryWorkDayDto) {
    return this.workHoursService.getByDate(user.sub, user.role, query);
  }

  @Get('monthly')
  @Roles(Role.OWNER)
  getMonthly(@Query() query: QueryMonthlyWorkHoursDto) {
    return this.workHoursService.getMonthly(query);
  }
}
