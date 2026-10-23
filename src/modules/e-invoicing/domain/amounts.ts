import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/**
 * Exact decimal arithmetic for DIAN amounts using integers.
 *
 * - Money is handled in integer cents (2 decimals, like `DECIMAL(14,2)`).
 * - Quantities in hundredths (UBL quantities are emitted with 2 decimals).
 * - Tax rates in basis points (19.00 % → 1900).
 *
 * Rounding is half-up (away from zero for positives), the behaviour of PHP
 * `round()`/`number_format()` used by the legacy generator. Floating point is
 * never used for money, avoiding the `toFixed` pitfalls noted in the analysis.
 */
export const Amounts = {
  /** Parses a decimal (number or string) into integer units with `scale` decimals, rounding half-up. */
  toScaled(value: number | string, scale: 2, field: string): number {
    const raw = typeof value === 'number' ? value.toString() : value.trim();
    if (!/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(raw)) {
      throw new BusinessRuleViolationError(`Valor numérico inválido en "${field}": ${value}.`, 'INVALID_AMOUNT', {
        field,
      });
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      throw new BusinessRuleViolationError(`Valor numérico inválido en "${field}": ${value}.`, 'INVALID_AMOUNT', {
        field,
      });
    }
    const [integer, fraction = ''] = Math.abs(numeric)
      .toFixed(scale + 2)
      .split('.');
    const units = Number(integer) * 10 ** scale + Number(fraction.slice(0, scale).padEnd(scale, '0'));
    const roundUp = Number(fraction[scale] ?? '0') >= 5 ? 1 : 0;
    return Math.sign(numeric) * (units + roundUp);
  },

  /** `numerator / denominator` rounded half-up (positive operands). */
  divideHalfUp(numerator: number, denominator: number): number {
    return Math.floor((numerator * 2 + denominator) / (denominator * 2));
  },

  /** Cents of `quantity × unitPrice` (quantity in hundredths). */
  lineTotal(quantityHundredths: number, unitPriceCents: number): number {
    return Amounts.divideHalfUp(quantityHundredths * unitPriceCents, 100);
  },

  /** Cents of `base × rate` (rate in basis points). */
  tax(baseCents: number, rateBasisPoints: number): number {
    return Amounts.divideHalfUp(baseCents * rateBasisPoints, 10_000);
  },

  /** Formats integer units with 2 decimals, dot separator and no grouping (`119000.00`). */
  format(units: number): string {
    const sign = units < 0 ? '-' : '';
    const absolute = Math.abs(units);
    return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
  },

  /** Converts cents into a JS number (for events and JSON views). */
  toNumber(cents: number): number {
    return cents / 100;
  },
};
