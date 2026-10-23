import type { AccountLevel } from './account-code.js';
import type { AccountNature, AccountType } from './account-type.js';
import type { Account } from './account.js';

/** Posted debits and credits of an account in cents. */
export interface Movement {
  debit: number;
  credit: number;
}

/**
 * Row of a balance report in cents. `opening` and `closing` are signed
 * D − C balances; use {@link naturalBalance} to present them by nature.
 */
export interface LedgerRow {
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  level: AccountLevel;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
}

const NONE: Movement = { debit: 0, credit: 0 };

/**
 * Pure ledger arithmetic shared by the trial balance, general ledger,
 * income statement and balance sheet (legacy `accounting/reports.php`, whose
 * formulas were wrong — bugs 2, 3 and 12).
 */
export const Ledger = {
  /**
   * One row per account with movements or balance. With `level`, rows are
   * aggregated by the code prefix of that level (e.g. level 3 → 4-digit
   * accounts); accounts with shorter codes keep their own row so totals
   * always match.
   */
  rows(
    accounts: readonly Account[],
    opening: ReadonlyMap<number, Movement>,
    period: ReadonlyMap<number, Movement>,
    level?: AccountLevel,
  ): LedgerRow[] {
    const byCode = new Map(accounts.map((account) => [account.code.toString(), account]));
    const groups = new Map<string, LedgerRow>();
    for (const account of accounts) {
      const before = opening.get(account.id as number) ?? NONE;
      const during = period.get(account.id as number) ?? NONE;
      if (before === NONE && during === NONE) continue;
      const key = level ? account.code.truncateTo(level) : account.code.toString();
      const head = byCode.get(key) ?? account;
      const row = groups.get(key) ?? {
        code: key,
        name: head.name,
        type: head.type,
        nature: head.nature,
        level: head.level,
        opening: 0,
        debit: 0,
        credit: 0,
        closing: 0,
      };
      row.opening += before.debit - before.credit;
      row.debit += during.debit;
      row.credit += during.credit;
      row.closing = row.opening + row.debit - row.credit;
      groups.set(key, row);
    }
    return [...groups.values()]
      .filter((row) => row.opening !== 0 || row.debit !== 0 || row.credit !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  /** Signed D − C balance expressed according to the nature (positive = normal balance). */
  naturalBalance(signedDebitMinusCredit: number, nature: AccountNature): number {
    return nature === 'debito' ? signedDebitMinusCredit : -signedDebitMinusCredit;
  },

  /** Sum of the natural closing balances of the rows of the given types. */
  totalByTypes(rows: readonly LedgerRow[], types: readonly AccountType[]): number {
    return rows
      .filter((row) => types.includes(row.type))
      .reduce((acc, row) => acc + Ledger.naturalBalance(row.closing, row.nature), 0);
  },
};
