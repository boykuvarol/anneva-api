import { DatingMethod } from '@prisma/client';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

function toInteger({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}

export class UpdatePregnancyDto {
  @IsOptional()
  @IsEnum(DatingMethod, { message: 'Gebelik tarihleme yöntemi geçersiz.' })
  datingMethod?: DatingMethod;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Son adet tarihi geçerli bir ISO tarih olmalı.' },
  )
  lastMenstrualPeriod?: string;

  @IsOptional()
  @Transform(toInteger)
  @IsInt({ message: 'Döngü uzunluğu tam sayı olmalı.' })
  @Min(20, { message: 'Döngü uzunluğu en az 20 gün olmalı.' })
  @Max(45, { message: 'Döngü uzunluğu en fazla 45 gün olabilir.' })
  cycleLength?: number;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Doktor doğum tarihi geçerli bir ISO tarih olmalı.' },
  )
  doctorDueDate?: string;
}
