import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
/** Colombia does not observe daylight saving time: UTC−05:00 all year. */
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/**
 * Helpers for "date only" values (`YYYY-MM-DD`) used by accounting dates.
 * Strings in this format compare chronologically with `<`/`>`.
 */
export const CalendarDay = {
  /** Validates a `YYYY-MM-DD` string that denotes a real calendar day. */
  parse(value: string, field: string): string {
    const match = DAY_PATTERN.exec(value ?? '');
    const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
    if (!match || !date || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) {
      throw new BusinessRuleViolationError(
        `El campo "${field}" debe ser una fecha válida con formato AAAA-MM-DD.`,
        'INVALID_DATE',
        { field },
      );
    }
    return value;
  },

  /** Adds (or subtracts) whole days. */
  addDays(day: string, days: number): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  },

  /** Calendar day in Colombia (UTC−05:00) of an instant. */
  inColombia(instant: Date): string {
    return new Date(instant.getTime() + COLOMBIA_OFFSET_MS).toISOString().slice(0, 10);
  },

  /** First and last day of a `YYYY-MM` month. */
  monthRange(month: string): { from: string; to: string } {
    const match = MONTH_PATTERN.exec(month ?? '');
    if (!match || +match[2] < 1 || +match[2] > 12) {
      throw new BusinessRuleViolationError('El mes debe tener formato AAAA-MM.', 'INVALID_MONTH');
    }
    const last = new Date(Date.UTC(+match[1], +match[2], 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
  },

  /** Fails when `to` is before `from`. */
  assertRange(from: string, to: string): void {
    if (to < from) {
      throw new BusinessRuleViolationError('La fecha final no puede ser anterior a la inicial.', 'INVERTED_DATES');
    }
  },
};
