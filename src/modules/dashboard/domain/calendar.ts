/** Time zone of every school (legacy `TIMEZONE`). "Today" is always the Colombian calendar day. */
export const SCHOOL_TIME_ZONE = 'America/Bogota';

const MONTH_ABBREVIATIONS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAY_MS = 86_400_000;

const toUtc = (day: string): Date => new Date(`${day}T00:00:00Z`);
const toDay = (date: Date): string => date.toISOString().slice(0, 10);

/** Calendar helpers on `YYYY-MM-DD` days and `YYYY-MM` months. */
export const Calendar = {
  /** Calendar day of an instant in the school time zone. */
  localDay(instant: Date, timeZone = SCHOOL_TIME_ZONE): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      instant,
    );
  },

  addDays(day: string, days: number): string {
    return toDay(new Date(toUtc(day).getTime() + days * DAY_MS));
  },

  /** First day of the month of `day`, shifted by `months`. */
  monthStart(day: string, months = 0): string {
    const date = toUtc(day);
    return toDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)));
  },

  /** Whole days from `from` to `to` (negative when `to` is earlier). */
  daysBetween(from: string, to: string): number {
    return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
  },

  /** The `count` months ending with the month of `day`, oldest first, as `YYYY-MM`. */
  lastMonths(day: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => Calendar.monthStart(day, i - count + 1).slice(0, 7));
  },

  /** Spanish abbreviation of a `YYYY-MM` month (legacy showed English names, bug B16). */
  monthLabel(month: string): string {
    return MONTH_ABBREVIATIONS[Number(month.slice(5, 7)) - 1] ?? month;
  },
};
