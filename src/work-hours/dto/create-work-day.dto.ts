import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateWorkDayDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shift1Start?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shift1End?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shift2Start?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  shift2End?: string;
}
