import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../shared/domain/value-object.js';
import { Calendar } from './calendar.js';

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Billed month (`YYYY-MM`). Charges are deduplicated per (student, concept,
 * period) and their default due date is the last day of the period
 * (legacy `finance/student_billing.php`, `date('Y-m-t')`).
 */
export class BillingPeriod extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): BillingPeriod {
    if (!PERIOD_PATTERN.test(raw ?? '')) {
      throw new BusinessRuleViolationError(`Mes inválido: "${raw}". Use el formato AAAA-MM.`, 'INVALID_PERIOD');
    }
    return new BillingPeriod(raw);
  }

  /** Period containing a `YYYY-MM-DD` day. */
  static fromDate(date: string): BillingPeriod {
    return BillingPeriod.create(date.slice(0, 7));
  }

  get year(): number {
    return Number(this.value.slice(0, 4));
  }

  get month(): number {
    return Number(this.value.slice(5, 7));
  }

  firstDay(): string {
    return `${this.value}-01`;
  }

  lastDay(): string {
    return Calendar.addDays(this.next().firstDay(), -1);
  }

  next(): BillingPeriod {
    const month = this.month === 12 ? 1 : this.month + 1;
    const year = this.month === 12 ? this.year + 1 : this.year;
    return new BillingPeriod(`${year}-${String(month).padStart(2, '0')}`);
  }

  previous(): BillingPeriod {
    const month = this.month === 1 ? 12 : this.month - 1;
    const year = this.month === 1 ? this.year - 1 : this.year;
    return new BillingPeriod(`${year}-${String(month).padStart(2, '0')}`);
  }

  /** Spanish label, e.g. `Marzo 2026` (legacy printed the month in English, bug B16). */
  label(): string {
    return `${MONTHS_ES[this.month - 1]} ${this.year}`;
  }

  toString(): string {
    return this.value;
  }
}
