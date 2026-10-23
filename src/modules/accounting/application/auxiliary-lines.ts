import type { AccountNature } from '../domain/account-type.js';
import { Ledger } from '../domain/ledger.js';
import { toAmount } from './ledger-reader.js';
import type { LedgerLineRow } from './ports/ledger-query.port.js';
import type { AuxiliaryLineView } from './report-views.js';

/**
 * Detailed lines with a running balance according to the account nature
 * (bug 12: the legacy ignored the nature and showed `abs()`).
 */
export const toAuxiliaryLines = (
  rows: readonly LedgerLineRow[],
  nature: AccountNature,
  openingCents: number,
): AuxiliaryLineView[] => {
  let running = openingCents;
  return rows.map((row) => {
    running += Ledger.naturalBalance(row.debit.cents - row.credit.cents, nature);
    return {
      date: row.entryDate,
      entryId: row.entryId,
      voucher: `${row.entryType}-${row.entryNumber}`,
      entryDescription: row.entryDescription,
      thirdPartyId: row.thirdPartyId,
      thirdPartyName: row.thirdPartyName,
      description: row.description,
      debit: row.debit.amount,
      credit: row.credit.amount,
      balance: toAmount(running),
    };
  });
};
