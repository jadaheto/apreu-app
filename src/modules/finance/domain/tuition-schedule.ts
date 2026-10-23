import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';

/** Monthly amount for a grade and concept; `conceptId = null` is the grade's "General" rate. */
export interface TuitionRate {
  gradeId: number;
  conceptId: number | null;
  amount: Money;
}

/**
 * Rates per grade for one academic year (table `grade_tuition`, legacy
 * `settings.php?tab=tuition`). Legacy configured them but never used them
 * (bug B17); here they drive charge generation (rule RN-03).
 *
 * Invariants: one rate per (grade, concept), positive amounts, valid year.
 */
export class TuitionSchedule {
  private constructor(
    readonly academicYear: number,
    private readonly rates: readonly TuitionRate[],
  ) {}

  static create(
    academicYear: number,
    rates: { gradeId: number; conceptId: number | null; amount: number }[],
  ): TuitionSchedule {
    Guard.inRange(academicYear, 2000, 2100, 'año académico');
    const seen = new Set<string>();
    const normalized = rates.map((rate) => {
      if (!Number.isInteger(rate.gradeId) || rate.gradeId <= 0) {
        throw new BusinessRuleViolationError('Cada tarifa debe indicar un grado.', 'TUITION_GRADE_REQUIRED');
      }
      const amount = Money.of(rate.amount);
      if (!amount.isGreaterThan(Money.zero())) {
        throw new BusinessRuleViolationError(
          'El valor de cada tarifa debe ser mayor que cero.',
          'INVALID_TUITION_AMOUNT',
        );
      }
      const key = `${rate.gradeId}:${rate.conceptId ?? 'general'}`;
      if (seen.has(key)) {
        throw new BusinessRuleViolationError(
          'Hay tarifas repetidas para el mismo grado y concepto.',
          'DUPLICATED_TUITION_RATE',
          { gradeId: rate.gradeId, conceptId: rate.conceptId },
        );
      }
      seen.add(key);
      return { gradeId: rate.gradeId, conceptId: rate.conceptId ?? null, amount };
    });
    return new TuitionSchedule(academicYear, normalized);
  }

  static restore(academicYear: number, rates: TuitionRate[]): TuitionSchedule {
    return new TuitionSchedule(academicYear, [...rates]);
  }

  get all(): readonly TuitionRate[] {
    return this.rates;
  }

  gradeIds(): number[] {
    return [...new Set(this.rates.map((rate) => rate.gradeId))];
  }

  conceptIds(): number[] {
    return [...new Set(this.rates.flatMap((rate) => (rate.conceptId === null ? [] : [rate.conceptId])))];
  }

  /** Specific rate of the concept for the grade, falling back to the grade's general rate. */
  rateFor(gradeId: number, conceptId: number): Money | null {
    const specific = this.rates.find((rate) => rate.gradeId === gradeId && rate.conceptId === conceptId);
    const general = this.rates.find((rate) => rate.gradeId === gradeId && rate.conceptId === null);
    return (specific ?? general)?.amount ?? null;
  }
}
