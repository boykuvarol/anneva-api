import { DatingMethod } from '@prisma/client';
import { PregnancyCalculationService } from './pregnancy-calculation.service';

describe('PregnancyCalculationService', () => {
  let service: PregnancyCalculationService;

  beforeEach(() => {
    service = new PregnancyCalculationService();
  });

  it('calculates LMP due date with cycle length adjustment using UTC date-only math', () => {
    const result = service.calculate(
      {
        datingMethod: DatingMethod.lmp,
        lastMenstrualPeriod: new Date('2026-01-01T12:00:00.000Z'),
        cycleLength: 30,
        doctorDueDate: null,
      },
      new Date('2026-01-17T23:00:00.000Z'),
    );

    expect(result.estimatedDueDate.toISOString()).toBe(
      '2026-10-10T00:00:00.000Z',
    );
    expect(result.gestationalWeek).toBe(2);
    expect(result.gestationalDay).toBe(0);
    expect(result.displayWeek).toBe(3);
    expect(result.trimester).toBe(1);
    expect(result.daysRemaining).toBe(266);
  });

  it('derives gestational age from doctor due date', () => {
    const result = service.calculate(
      {
        datingMethod: DatingMethod.doctorDueDate,
        lastMenstrualPeriod: null,
        cycleLength: 28,
        doctorDueDate: new Date('2026-10-08T00:00:00.000Z'),
      },
      new Date('2026-04-09T10:30:00.000Z'),
    );

    expect(result.gestationalWeek).toBe(14);
    expect(result.gestationalDay).toBe(0);
    expect(result.displayWeek).toBe(15);
    expect(result.trimester).toBe(2);
  });
});
