import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class QueryWorkDayDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
