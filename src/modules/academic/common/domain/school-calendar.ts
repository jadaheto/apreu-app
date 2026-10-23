import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

/** Colombia has no daylight saving time: school clocks are always UTC-05:00. */
const SCHOOL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Inclusive range of calendar days (`YYYY-MM-DD`). */
export interface DateInterval {
  from: string;
  to: string;
}

/** True for a real calendar day written as `YYYY-MM-DD`. */
export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Returns the date or throws `INVALID_DATE`. */
export const assertIsoDate = (value: unknown, field: string): string => {
  if (!isIsoDate(value)) {
    throw new BusinessRuleViolationError(`La fecha "${field}" debe tener el formato AAAA-MM-DD.`, 'INVALID_DATE', {
      field,
    });
  }
  return value;
};

const toSchoolTime = (instant: Date): Date => new Date(instant.getTime() + SCHOOL_UTC_OFFSET_MS);

/** Calendar day at the school (UTC-05:00) for an instant. */
export const schoolDateOf = (instant: Date): string => toSchoolTime(instant).toISOString().slice(0, 10);

/** Wall-clock time `HH:mm:ss` at the school for an instant. */
export const schoolTimeOf = (instant: Date): string => toSchoolTime(instant).toISOString().slice(11, 19);

/** Month `YYYY-MM` at the school for an instant. */
export const schoolMonthOf = (instant: Date): string => schoolDateOf(instant).slice(0, 7);

/** First and last day of a `YYYY-MM` month. */
export const monthInterval = (month: string): DateInterval => {
  const match = ISO_MONTH.exec(month);
  if (!match) {
    throw new BusinessRuleViolationError('El mes debe tener el formato AAAA-MM.', 'INVALID_MONTH');
  }
  const [year, monthNumber] = [Number(match[1]), Number(match[2])];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
};

/** Year part of a `YYYY-MM-DD` date. */
export const yearOfDate = (isoDate: string): number => Number(isoDate.slice(0, 4));
