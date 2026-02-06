import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateSaleByCodeDto } from './dto/create-sale-by-code.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles(Role.OWNER, Role.CASHIER)
  create(@GetUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.sub, dto);
  }

  @Post('by-code')
  @Roles(Role.OWNER, Role.CASHIER)
  createByCode(@GetUser() user: JwtPayload, @Body() dto: CreateSaleByCodeDto) {
    return this.salesService.createByCode(user.sub, dto);
  }

  @Get('today')
  @Roles(Role.OWNER, Role.CASHIER)
  today() {
    return this.salesService.today();
  }

  @Get(':id/receipt')
  @Roles(Role.OWNER, Role.CASHIER)
  getReceipt(@Param('id') id: string) {
    return this.salesService.getReceipt(id);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.CASHIER)
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
