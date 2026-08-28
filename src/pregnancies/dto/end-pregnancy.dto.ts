import { PregnancyStatus } from '@prisma/client';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

const endablePregnancyStatuses = [
  PregnancyStatus.completed,
  PregnancyStatus.loss,
  PregnancyStatus.terminated,
] as const;

export type EndablePregnancyStatus = (typeof endablePregnancyStatuses)[number];

export class EndPregnancyDto {
  @IsIn(endablePregnancyStatuses, {
    message: 'Gebelik durumu tamamlandı, kayıp veya sonlandırıldı olmalı.',
  })
  status!: EndablePregnancyStatus;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'Bitiş tarihi geçerli bir ISO tarih olmalı.' },
  )
  endedAt?: string;
}
