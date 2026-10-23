import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { Account } from './account.js';
import type { AccountingPeriod } from './accounting-period.js';
import type { JournalEntry } from './journal-entry.js';
import type { ThirdParty } from './third-party.js';

/** Aggregates referenced by an entry, loaded by the use case. */
export interface BookingContext {
  period: AccountingPeriod | null;
  accounts: ReadonlyMap<number, Account>;
  thirdParties: ReadonlyMap<number, ThirdParty>;
}

/**
 * Cross-aggregate rules to book (post) a journal entry. Fixes legacy bugs 7/8:
 * - RN-PER-03: the period exists and is open.
 * - RN-JE-09: the entry date lies inside the period.
 * - RN-ACC-05: every account exists and is transactional ("de movimiento").
 * - Third parties exist and are active.
 */
export const JournalEntryPolicy = {
  assertBookable(entry: JournalEntry, { period, accounts, thirdParties }: BookingContext): void {
    if (!period) throw new NotFoundError('Periodo contable', entry.periodId);
    period.assertOpen();
    if (!period.contains(entry.date)) {
      throw new BusinessRuleViolationError(
        `La fecha ${entry.date} no está dentro del periodo "${period.name}" (${period.startDate} a ${period.endDate}).`,
        'DATE_OUTSIDE_PERIOD',
      );
    }
    for (const line of entry.lines) {
      const account = accounts.get(line.accountId);
      if (!account) throw new NotFoundError('Cuenta contable', line.accountId);
      if (!account.isTransactional) {
        throw new BusinessRuleViolationError(
          `La cuenta ${account.code.toString()} — ${account.name} es una cuenta mayor y no recibe movimientos.`,
          'ACCOUNT_NOT_TRANSACTIONAL',
        );
      }
      if (line.thirdPartyId === null) continue;
      const thirdParty = thirdParties.get(line.thirdPartyId);
      if (!thirdParty) throw new NotFoundError('Tercero', line.thirdPartyId);
      if (!thirdParty.isActive) {
        throw new BusinessRuleViolationError(`El tercero "${thirdParty.name}" está inactivo.`, 'THIRD_PARTY_INACTIVE');
      }
    }
  },
};
