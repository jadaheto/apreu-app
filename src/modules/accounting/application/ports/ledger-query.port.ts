import type { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { VoucherType } from '../../domain/voucher-type.js';

/** Filters over posted journal lines. Dates are inclusive `YYYY-MM-DD`. */
export interface LedgerCriteria {
  from?: string;
  to?: string;
  thirdPartyId?: number;
  entryType?: VoucherType;
  accountIds?: number[];
}

export interface AccountMovementRow {
  accountId: number;
  debit: Money;
  credit: Money;
}

export interface LedgerLineRow {
  entryId: number;
  entryDate: string;
  entryType: VoucherType;
  entryNumber: string;
  entryDescription: string;
  accountId: number;
  thirdPartyId: number | null;
  thirdPartyName: string | null;
  description: string | null;
  debit: Money;
  credit: Money;
}

/**
 * Read model over **posted** entries only (voided and draft entries never
 * count, RN-JE-07). Filters are applied in the WHERE clause (bug 2: the
 * legacy trial balance put them in a LEFT JOIN `ON` and summed every line).
 */
export interface LedgerQueryPort {
  movementsByAccount(criteria: LedgerCriteria): Promise<AccountMovementRow[]>;
  /** Detailed lines ordered by date, entry and line. */
  lines(criteria: LedgerCriteria): Promise<LedgerLineRow[]>;
  countPostedEntries(criteria: LedgerCriteria): Promise<number>;
}

export const LEDGER_QUERY = Symbol('LedgerQueryPort');
