import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cashAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cardAmount?: number;
}
