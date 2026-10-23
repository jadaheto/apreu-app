import type { AccountType } from '../domain/account-type.js';
import { Ledger, type LedgerRow } from '../domain/ledger.js';
import { toAmount } from './ledger-reader.js';
import type { StatementSectionView } from './report-views.js';

/** Rows of the given types with their natural closing balance, plus the section total. */
export const statementSection = (rows: readonly LedgerRow[], types: readonly AccountType[]): StatementSectionView => {
  const selected = rows.filter((row) => types.includes(row.type));
  return {
    rows: selected
      .map((row) => ({
        code: row.code,
        name: row.name,
        amount: toAmount(Ledger.naturalBalance(row.closing, row.nature)),
      }))
      .filter((row) => row.amount !== 0),
    total: toAmount(Ledger.totalByTypes(selected, types)),
  };
};
