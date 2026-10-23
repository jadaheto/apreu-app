import { Amounts } from './amounts.js';

describe('Amounts', () => {
  it('parses decimals into integer units rounding half-up', () => {
    expect(Amounts.toScaled(1.005, 2, 'x')).toBe(101);
    expect(Amounts.toScaled('119000', 2, 'x')).toBe(11_900_000);
    expect(Amounts.toScaled('0.125', 2, 'x')).toBe(13);
    expect(() => Amounts.toScaled('abc', 2, 'x')).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });

  it('computes line totals and taxes like PHP round()', () => {
    expect(Amounts.lineTotal(150, 33_333)).toBe(50_000); // 1.5 × 333.33 = 499.995 → 500.00
    expect(Amounts.tax(5_025, 1_900)).toBe(955); // 50.25 × 19 % = 9.5475 → 9.55
  });

  it('formats with two decimals, dot and no grouping', () => {
    expect(Amounts.format(11_900_000)).toBe('119000.00');
    expect(Amounts.format(5)).toBe('0.05');
    expect(Amounts.format(-150)).toBe('-1.50');
  });
});
