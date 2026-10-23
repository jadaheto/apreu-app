import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { TaxRate } from './tax-rate.vo.js';

/**
 * Monetary breakdown of a charge (`student_charges.amount`, `tax_rate`,
 * `tax_amount`, `discount_amount`, `net_amount`).
 *
 * Rule RN-04: the tax is computed on the taxable base (base − discount),
 * rounded to cents, and `net = base − discount + tax`.
 */
export class ChargeAmounts {
  private constructor(
    readonly base: Money,
    readonly taxRate: TaxRate,
    readonly discount: Money,
    readonly tax: Money,
    readonly net: Money,
  ) {
    Object.freeze(this);
  }

  static compute(base: Money, taxRate: TaxRate, discount: Money = Money.zero()): ChargeAmounts {
    if (!base.isGreaterThan(Money.zero())) {
      throw new BusinessRuleViolationError('El valor del cargo debe ser mayor que cero.', 'INVALID_CHARGE_AMOUNT');
    }
    if (discount.isNegative() || discount.isGreaterThan(base)) {
      throw new BusinessRuleViolationError(
        'El descuento debe estar entre cero y el valor del cargo.',
        'INVALID_DISCOUNT',
      );
    }
    const taxable = base.subtract(discount);
    const tax = taxable.percent(taxRate.percent);
    return new ChargeAmounts(base, taxRate, discount, tax, taxable.add(tax));
  }

  /** Rebuilds persisted amounts as stored (legacy rows are trusted). */
  static restore(values: { base: Money; taxRate: TaxRate; discount: Money; tax: Money; net: Money }): ChargeAmounts {
    return new ChargeAmounts(values.base, values.taxRate, values.discount, values.tax, values.net);
  }
}
