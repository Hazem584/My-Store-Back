import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateSaleItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  unitPriceOverride?: number;
}
