import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../../shared/domain/value-object.js';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * A billing month `YYYY-MM` (RN-COM-07).
 *
 * Fixes legacy bug #15: `email/send_billing.php` filtered `due_date BETWEEN
 * '{mes}-01' AND '{mes}-31'`, an invalid date for 30/28-day months. Here the
 * real last day of the month is computed.
 */
export class BillingMonth extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): BillingMonth {
    const value = (raw ?? '').trim();
    if (!MONTH_PATTERN.test(value)) {
      throw new BusinessRuleViolationError('El mes debe tener el formato AAAA-MM.', 'INVALID_MONTH');
    }
    return new BillingMonth(value);
  }

  /** First day, `YYYY-MM-01`. */
  get firstDay(): string {
    return `${this.value}-01`;
  }

  /** Last calendar day of the month, e.g. `2026-02-28`. */
  get lastDay(): string {
    const [year, month] = this.value.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${this.value}-${String(days).padStart(2, '0')}`;
  }

  toString(): string {
    return this.value;
  }
}
