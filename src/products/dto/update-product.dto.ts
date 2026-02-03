import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  code?: string;
}
