import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

/** Colombia does not observe daylight saving time: local time is always UTC−05:00. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Helpers for "date only" values (`YYYY-MM-DD`) expressed in the school's
 * local time (America/Bogota). Due dates, expense dates and report ranges are
 * calendar days, never instants.
 */
export const Calendar = {
  /** Local calendar day of an instant. */
  today(now: Date): string {
    return new Date(now.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
  },

  /** Validates a `YYYY-MM-DD` string that denotes an existing day. */
  assertDate(value: string, field: string): string {
    const parsed = DATE_PATTERN.test(value ?? '') ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BusinessRuleViolationError(`La fecha "${field}" no es válida (AAAA-MM-DD).`, 'INVALID_DATE', { field });
    }
    return value;
  },

  /** Whole days from `from` to `to` (positive when `to` is later). */
  daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
  },

  /** Adds days to a calendar day. */
  addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
  },

  /** Instant at which a local calendar day starts. */
  startOfDay(date: string): Date {
    return new Date(Date.parse(`${date}T00:00:00Z`) + BOGOTA_OFFSET_MS);
  },

  /** `YYYYMMDD`, as used by bank flat files. */
  compact(date: string): string {
    return date.replace(/-/g, '');
  },

  year(date: string): number {
    return Number(date.slice(0, 4));
  },
};
