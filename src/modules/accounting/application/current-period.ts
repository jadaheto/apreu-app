import type { AccountingPeriod } from '../domain/accounting-period.js';
import type { AccountingPeriodRepository } from '../domain/accounting-period.repository.js';

/**
 * Period that contains `day` (RN-PER-05). Deterministic (bug 11): an open
 * period wins over a closed one, then the most recent start date.
 */
export const findCurrentPeriod = async (
  periods: AccountingPeriodRepository,
  day: string,
): Promise<AccountingPeriod | null> => {
  const candidates = await periods.findContaining(day);
  return candidates.find((period) => period.isOpen) ?? candidates[0] ?? null;
};
