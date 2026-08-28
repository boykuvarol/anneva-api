import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateMeDto {
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'İsim metin olmalı.' })
  @MinLength(1, { message: 'İsim boş olamaz.' })
  @MaxLength(80, { message: 'İsim en fazla 80 karakter olabilir.' })
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Dil kodu metin olmalı.' })
  @IsIn(['tr'], { message: 'Şimdilik yalnızca tr dili destekleniyor.' })
  locale?: string;
}
