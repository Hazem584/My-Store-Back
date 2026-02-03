import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSaleByCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

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
