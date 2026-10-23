import { Inject, Injectable } from '@nestjs/common';
import type { AccountLevel } from '../domain/account-code.js';
import type { Account } from '../domain/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { Ledger, type LedgerRow, type Movement } from '../domain/ledger.js';
import {
  LEDGER_QUERY,
  type AccountMovementRow,
  type LedgerCriteria,
  type LedgerQueryPort,
} from './ports/ledger-query.port.js';

export interface LedgerRowsRequest {
  /** Start of the period; movements before it form the opening balance. Omit for "since the beginning". */
  from?: string;
  to: string;
  thirdPartyId?: number;
  /** Restrict to these accounts (already expanded to descendants). */
  accounts?: readonly Account[];
  level?: AccountLevel;
  /** Compute the opening balance before `from` (default `true`); `false` for income-type reports. */
  withOpening?: boolean;
}

const toMovements = (rows: AccountMovementRow[]): Map<number, Movement> =>
  new Map(rows.map((row) => [row.accountId, { debit: row.debit.cents, credit: row.credit.cents }]));

/** Validates a report date range (`from <= to`). */
export const parseRange = (from: string, to: string): { from: string; to: string } => {
  const range = { from: CalendarDay.parse(from, 'desde'), to: CalendarDay.parse(to, 'hasta') };
  CalendarDay.assertRange(range.from, range.to);
  return range;
};

/** Cents → pesos. */
export const toAmount = (cents: number): number => cents / 100;

/**
 * Builds {@link LedgerRow}s (opening balance, period movements, closing
 * balance) from posted lines. Shared by the balance-type reports.
 */
@Injectable()
export class LedgerReader {
  constructor(
    @Inject(LEDGER_QUERY) private readonly ledger: LedgerQueryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  allAccounts(): Promise<Account[]> {
    return this.accounts.findAll();
  }

  /** The account and all accounts below it in the PUC (by code prefix). */
  async withDescendants(account: Account): Promise<Account[]> {
    return (await this.accounts.findAll()).filter(
      (candidate) => candidate.id === account.id || account.code.isAncestorOf(candidate.code),
    );
  }

  async rows(request: LedgerRowsRequest): Promise<LedgerRow[]> {
    const accounts = request.accounts ?? (await this.accounts.findAll());
    const base: LedgerCriteria = {
      thirdPartyId: request.thirdPartyId,
      accountIds: request.accounts?.map((account) => account.id as number),
    };
    const [opening, period] = await Promise.all([
      request.from && request.withOpening !== false
        ? this.ledger.movementsByAccount({ ...base, to: CalendarDay.addDays(request.from, -1) })
        : Promise.resolve([]),
      this.ledger.movementsByAccount({ ...base, from: request.from, to: request.to }),
    ]);
    return Ledger.rows(accounts, toMovements(opening), toMovements(period), request.level);
  }
}
