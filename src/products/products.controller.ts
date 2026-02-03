import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.OWNER)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.CASHIER)
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get('by-code/:code')
  @Roles(Role.OWNER, Role.CASHIER)
  findByCode(@Param('code') code: string) {
    return this.productsService.findByCode(code);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.CASHIER)
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.OWNER)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
