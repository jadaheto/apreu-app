import type { OverdueCharge } from '../../domain/aging.js';

/** Source of overdue charges with balance for the aging report. */
export interface AgingSourcePort {
  /** Open charges due before `today` with pending balance, optionally of one grade. */
  overdueCharges(filter: { today: string; gradeId?: number }): Promise<OverdueCharge[]>;
}

export const AGING_SOURCE = Symbol('AgingSourcePort');
