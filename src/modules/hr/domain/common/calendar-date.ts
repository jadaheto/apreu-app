import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

/** A day without time, formatted `YYYY-MM-DD` (lexicographic order = chronological order). */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Colombia has no daylight saving time: local time is always UTC-5. */
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Pure helpers for "day only" dates used by HR and payroll rules:
 * calendar days, Colombian commercial days (30-day months, art. 134 CST) and
 * conversions from instants in the Bogotá time zone.
 */
export const CalendarDate = {
  /** Validates format and that the day exists; returns the trimmed value. */
  assert(value: string, field: string): IsoDate {
    const trimmed = value?.trim() ?? '';
    const match = ISO_DATE.exec(trimmed);
    if (!match) throw invalidDate(field);
    const [, y, m, d] = match.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > CalendarDate.daysInMonth(y, m)) throw invalidDate(field);
    return trimmed;
  },

  /** Like {@link assert} but accepts `null`/empty as "no date". */
  assertOptional(value: string | null | undefined, field: string): IsoDate | null {
    if (value === null || value === undefined || value.trim() === '') return null;
    return CalendarDate.assert(value, field);
  },

  parts(date: IsoDate): DateParts {
    const [year, month, day] = date.split('-').map(Number);
    return { year, month, day };
  },

  of(year: number, month: number, day: number): IsoDate {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  },

  daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  },

  lastDayOfMonth(year: number, month: number): IsoDate {
    return CalendarDate.of(year, month, CalendarDate.daysInMonth(year, month));
  },

  isLastDayOfMonth(date: IsoDate): boolean {
    const { year, month, day } = CalendarDate.parts(date);
    return day === CalendarDate.daysInMonth(year, month);
  },

  max(a: IsoDate, b: IsoDate): IsoDate {
    return a >= b ? a : b;
  },

  min(a: IsoDate, b: IsoDate): IsoDate {
    return a <= b ? a : b;
  },

  /** True when both inclusive ranges share at least one day. */
  rangesOverlap(startA: IsoDate, endA: IsoDate, startB: IsoDate, endB: IsoDate): boolean {
    return startA <= endB && startB <= endA;
  },

  /** Calendar days between two dates, both inclusive (`2026-03-01..2026-03-01` = 1). */
  calendarDaysInclusive(start: IsoDate, end: IsoDate): number {
    if (end < start) return 0;
    return Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1;
  },

  /**
   * Commercial days (30/360) between two dates, both inclusive. Day 31 does
   * not count and the last day of February counts up to day 30, so a full
   * month is always 30 days and each fortnight 15.
   */
  commercialDaysInclusive(start: IsoDate, end: IsoDate): number {
    if (end < start) return 0;
    const a = CalendarDate.parts(start);
    const b = CalendarDate.parts(end);
    const startDay = a.day;
    const endDay = CalendarDate.isLastDayOfMonth(end) ? 30 : Math.min(b.day, 30);
    const days = (b.year - a.year) * 360 + (b.month - a.month) * 30 + (endDay - startDay) + 1;
    return Math.max(days, 0);
  },

  /** Local (Bogotá) calendar day of an instant. */
  fromInstant(instant: Date): IsoDate {
    return new Date(instant.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
  },

  /** Complete months elapsed between two dates (same rule in every screen, fixes legacy B-29). */
  fullMonthsBetween(from: IsoDate, to: IsoDate): number {
    if (to < from) return 0;
    const a = CalendarDate.parts(from);
    const b = CalendarDate.parts(to);
    let months = (b.year - a.year) * 12 + (b.month - a.month);
    if (b.day < a.day) months -= 1;
    return Math.max(months, 0);
  },
};

function toUtc(date: IsoDate): number {
  const { year, month, day } = CalendarDate.parts(date);
  return Date.UTC(year, month - 1, day);
}

function invalidDate(field: string): BusinessRuleViolationError {
  return new BusinessRuleViolationError(`La fecha "${field}" no es válida (formato AAAA-MM-DD).`, 'INVALID_DATE', {
    field,
  });
}
