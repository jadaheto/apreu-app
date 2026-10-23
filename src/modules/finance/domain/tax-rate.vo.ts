import { Guard } from '../../../shared/domain/guard.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

/** Tax (IVA) percentage between 0 and 100 with two decimals (`billing_concepts.tax_rate`). */
export class TaxRate extends ValueObject<number> {
  private constructor(value: number) {
    super(value);
  }

  static of(raw: number | string | null | undefined): TaxRate {
    const value = Number(raw ?? 0);
    if (!Number.isFinite(value)) {
      throw new BusinessRuleViolationError(`Porcentaje de impuesto inválido: "${raw}".`, 'INVALID_TAX_RATE');
    }
    Guard.inRange(value, 0, 100, 'porcentaje de IVA');
    return new TaxRate(Math.round(value * 100) / 100);
  }

  static zero(): TaxRate {
    return new TaxRate(0);
  }

  get percent(): number {
    return this.value;
  }
}
