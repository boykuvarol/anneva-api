import { Injectable } from '@nestjs/common';
import { DatingMethod, type Pregnancy } from '@prisma/client';

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const standardPregnancyDays = 280;

export type PregnancyCalculation = {
  estimatedDueDate: Date;
  gestationalWeek: number;
  gestationalDay: number;
  displayWeek: number;
  trimester: 1 | 2 | 3;
  daysRemaining: number;
};

type PregnancyDatingFields = Pick<
  Pregnancy,
  'datingMethod' | 'lastMenstrualPeriod' | 'cycleLength' | 'doctorDueDate'
>;

@Injectable()
export class PregnancyCalculationService {
  // All pregnancy dating arithmetic is normalized to UTC calendar dates.
  // This keeps date-only mobile inputs stable across server time zones and DST.
  calculate(
    pregnancy: PregnancyDatingFields,
    asOf: Date = new Date(),
  ): PregnancyCalculation {
    const estimatedDueDate = this.getEstimatedDueDate(pregnancy);
    const pregnancyStartDate = this.addUtcDays(
      estimatedDueDate,
      -standardPregnancyDays,
    );
    const today = this.toUtcDateOnly(asOf);
    const gestationalAgeDays = Math.max(
      0,
      this.diffUtcDays(today, pregnancyStartDate),
    );
    const boundedGestationalAgeDays = Math.min(
      standardPregnancyDays,
      gestationalAgeDays,
    );
    const gestationalWeek = Math.floor(boundedGestationalAgeDays / 7);
    const gestationalDay = boundedGestationalAgeDays % 7;
    const daysRemaining = Math.max(
      0,
      this.diffUtcDays(estimatedDueDate, today),
    );

    return {
      estimatedDueDate,
      gestationalWeek,
      gestationalDay,
      displayWeek: gestationalWeek + 1,
      trimester: this.getTrimester(gestationalWeek),
      daysRemaining,
    };
  }

  toUtcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  parseIsoDateOnly(value: string): Date {
    return this.toUtcDateOnly(new Date(value));
  }

  private getEstimatedDueDate(pregnancy: PregnancyDatingFields): Date {
    if (pregnancy.datingMethod === DatingMethod.doctorDueDate) {
      return this.toUtcDateOnly(pregnancy.doctorDueDate as Date);
    }

    const cycleAdjustmentDays = pregnancy.cycleLength - 28;
    return this.addUtcDays(
      this.toUtcDateOnly(pregnancy.lastMenstrualPeriod as Date),
      standardPregnancyDays + cycleAdjustmentDays,
    );
  }

  private addUtcDays(date: Date, days: number): Date {
    const utcDate = this.toUtcDateOnly(date);
    return new Date(utcDate.getTime() + days * millisecondsPerDay);
  }

  private diffUtcDays(later: Date, earlier: Date): number {
    return Math.floor(
      (this.toUtcDateOnly(later).getTime() -
        this.toUtcDateOnly(earlier).getTime()) /
        millisecondsPerDay,
    );
  }

  private getTrimester(gestationalWeek: number): 1 | 2 | 3 {
    if (gestationalWeek <= 13) {
      return 1;
    }

    if (gestationalWeek <= 27) {
      return 2;
    }

    return 3;
  }
}
