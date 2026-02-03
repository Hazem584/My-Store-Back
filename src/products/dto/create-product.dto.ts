import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsString()
  code?: string;
}
