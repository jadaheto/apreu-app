import type { AccountingPeriod, PeriodStatus } from '../domain/accounting-period.js';

/** Read model of an accounting period. */
export interface PeriodView {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: Date | null;
  closedBy: number | null;
  reopenedAt: Date | null;
  reopenedBy: number | null;
  reopenReason: string | null;
}

export const toPeriodView = (period: AccountingPeriod): PeriodView => ({
  id: period.id as number,
  name: period.name,
  startDate: period.startDate,
  endDate: period.endDate,
  status: period.status,
  closedAt: period.closedAt,
  closedBy: period.closedBy,
  reopenedAt: period.reopenedAt,
  reopenedBy: period.reopenedBy,
  reopenReason: period.reopenReason,
});
