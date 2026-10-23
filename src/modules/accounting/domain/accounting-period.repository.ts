import type { AccountingPeriod } from './accounting-period.js';

/** Output port for persisting {@link AccountingPeriod} aggregates. */
export interface AccountingPeriodRepository {
  findById(id: number): Promise<AccountingPeriod | null>;
  /** All periods, newest start date first. */
  findAll(): Promise<AccountingPeriod[]>;
  /** Periods whose range intersects `[startDate, endDate]`. */
  findOverlapping(startDate: string, endDate: string): Promise<AccountingPeriod[]>;
  /** Periods that contain the day, newest start date first. */
  findContaining(day: string): Promise<AccountingPeriod[]>;
  save(period: AccountingPeriod): Promise<void>;
}

export const ACCOUNTING_PERIOD_REPOSITORY = Symbol('AccountingPeriodRepository');
