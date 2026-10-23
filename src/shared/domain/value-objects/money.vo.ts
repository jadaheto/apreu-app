import { BusinessRuleViolationError } from '../domain-error.js';
import { ValueObject } from '../value-object.js';

/**
 * Monetary amount in Colombian pesos (COP).
 *
 * Internally stored as integer cents to avoid floating point drift; the
 * database columns are `DECIMAL(12,2)` so two decimals are preserved.
 */
export class Money extends ValueObject<number> {
  private constructor(cents: number) {
    super(cents);
  }

  /** Builds a Money from a decimal amount (e.g. `350000.5`). */
  static of(amount: number | string): Money {
    const numeric = typeof amount === 'string' ? Number(amount) : amount;
    if (!Number.isFinite(numeric)) {
      throw new BusinessRuleViolationError(`Monto inválido: "${amount}".`, 'INVALID_AMOUNT');
    }
    return new Money(Math.round(numeric * 100));
  }

  static zero(): Money {
    return new Money(0);
  }

  get amount(): number {
    return this.value / 100;
  }

  get cents(): number {
    return this.value;
  }

  add(other: Money): Money {
    return new Money(this.value + other.value);
  }

  subtract(other: Money): Money {
    return new Money(this.value - other.value);
  }

  /** Multiplies by a factor (e.g. a tax rate `0.19`) rounding half-up to cents. */
  multiply(factor: number): Money {
    return new Money(Math.round(this.value * factor));
  }

  /** Percentage of the amount, e.g. `percent(4)` → 4 %. */
  percent(rate: number): Money {
    return this.multiply(rate / 100);
  }

  isNegative(): boolean {
    return this.value < 0;
  }

  isZero(): boolean {
    return this.value === 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.value > other.value;
  }

  isLessThan(other: Money): boolean {
    return this.value < other.value;
  }

  min(other: Money): Money {
    return this.value <= other.value ? this : other;
  }

  /** Formats as Colombian currency, e.g. `$ 1.250.000`. */
  format(): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(this.amount);
  }
}
