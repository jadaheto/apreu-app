import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { BillingConcept } from './billing-concept.js';
import { ChargeAmounts } from './charge-amounts.vo.js';
import type { TuitionSchedule } from './tuition-schedule.js';

export interface ChargeAmountRequest {
  concept: BillingConcept;
  /** Grade of the student (null when the student has no classroom). */
  gradeId: number | null;
  tuition: TuitionSchedule;
  /** Explicit amount typed by the user; prevails over every rate. */
  customAmount?: number | null;
  /** Scholarship percentage of the student, applied as discount when requested. */
  scholarshipPct?: number;
}

/**
 * Computes the amounts of a new charge (rules RN-03/RN-04/RN-05).
 *
 * Base precedence: custom amount > grade rate for the concept > grade
 * "General" rate > concept base amount. A custom amount of 0 is rejected
 * instead of silently falling back (legacy bug B13). The concept's tax rate
 * is applied on the base minus the optional scholarship discount.
 */
export const ChargeAmountCalculator = {
  compute(request: ChargeAmountRequest): ChargeAmounts {
    const base = ChargeAmountCalculator.base(request);
    const discount = base.percent(Math.min(Math.max(request.scholarshipPct ?? 0, 0), 100));
    return ChargeAmounts.compute(base, request.concept.taxRate, discount);
  },

  base({ concept, gradeId, tuition, customAmount }: ChargeAmountRequest): Money {
    if (customAmount !== undefined && customAmount !== null) {
      const custom = Money.of(customAmount);
      if (!custom.isGreaterThan(Money.zero())) {
        throw new BusinessRuleViolationError(
          'El monto personalizado debe ser mayor que cero.',
          'INVALID_CHARGE_AMOUNT',
        );
      }
      return custom;
    }
    const rate = gradeId === null ? null : tuition.rateFor(gradeId, concept.id as number);
    return rate ?? concept.amount;
  },
};
