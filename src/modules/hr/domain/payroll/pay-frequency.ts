export const PAY_FREQUENCIES = ['monthly', 'biweekly'] as const;
/** Explicit payroll frequency (legacy deduced it from the number of days, B-14). */
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

/** Commercial length of each frequency: a month is 30 days, a fortnight 15. */
export const PERIOD_LENGTH_DAYS: Readonly<Record<PayFrequency, number>> = { monthly: 30, biweekly: 15 };
