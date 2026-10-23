import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { aConcept } from '../testing/fixtures.js';
import { ChargeAmountCalculator } from './charge-amount-calculator.js';
import { ChargeAmounts } from './charge-amounts.vo.js';
import { TaxRate } from './tax-rate.vo.js';
import { TuitionSchedule } from './tuition-schedule.js';

describe('TaxRate', () => {
  it('accepts 0..100 with two decimals', () => {
    expect(TaxRate.of('19.005').percent).toBe(19.01);
    expect(TaxRate.of(null).percent).toBe(0);
    expect(() => TaxRate.of(101)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => TaxRate.of('abc')).toThrow(expect.objectContaining({ code: 'INVALID_TAX_RATE' }));
  });
});

describe('ChargeAmounts', () => {
  it('applies the tax on the base (RN-04)', () => {
    const amounts = ChargeAmounts.compute(Money.of(200000), TaxRate.of(19));
    expect(amounts.tax.amount).toBe(38000);
    expect(amounts.net.amount).toBe(238000);
    expect(amounts.discount.isZero()).toBe(true);
  });

  it('taxes the base minus the discount', () => {
    const amounts = ChargeAmounts.compute(Money.of(100000), TaxRate.of(19), Money.of(10000));
    expect(amounts.tax.amount).toBe(17100);
    expect(amounts.net.amount).toBe(107100);
  });

  it('rejects non positive bases and invalid discounts', () => {
    expect(() => ChargeAmounts.compute(Money.zero(), TaxRate.zero())).toThrow(
      expect.objectContaining({ code: 'INVALID_CHARGE_AMOUNT' }),
    );
    expect(() => ChargeAmounts.compute(Money.of(10), TaxRate.zero(), Money.of(11))).toThrow(
      expect.objectContaining({ code: 'INVALID_DISCOUNT' }),
    );
  });
});

describe('ChargeAmountCalculator', () => {
  const concept = aConcept({ amount: 350000, taxRate: 0 });
  concept.assignId(5);
  const tuition = TuitionSchedule.create(2026, [
    { gradeId: 1, conceptId: 5, amount: 400000 },
    { gradeId: 2, conceptId: null, amount: 300000 },
  ]);

  it.each([
    [{ customAmount: 123000, gradeId: 1 }, 123000],
    [{ gradeId: 1 }, 400000],
    [{ gradeId: 2 }, 300000],
    [{ gradeId: 3 }, 350000],
    [{ gradeId: null }, 350000],
  ])('resolves the base by precedence %o', (request, expected) => {
    expect(ChargeAmountCalculator.base({ concept, tuition, ...request }).amount).toBe(expected);
  });

  it('rejects a custom amount of zero instead of falling back (bug B13)', () => {
    expect(() => ChargeAmountCalculator.base({ concept, tuition, gradeId: 1, customAmount: 0 })).toThrow(
      expect.objectContaining({ code: 'INVALID_CHARGE_AMOUNT' }),
    );
  });

  it('applies the scholarship as discount and the concept tax', () => {
    const taxed = aConcept({ amount: 100000, taxRate: 19 });
    taxed.assignId(6);
    const amounts = ChargeAmountCalculator.compute({ concept: taxed, tuition, gradeId: 3, scholarshipPct: 50 });
    expect(amounts.discount.amount).toBe(50000);
    expect(amounts.net.amount).toBe(59500);
  });
});
