import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { AccountLevel } from '../domain/account-code.js';
import { LedgerReader, parseRange, toAmount } from './ledger-reader.js';
import type { TrialBalanceRowView, TrialBalanceView } from './report-views.js';

export interface GetTrialBalanceInput {
  from: string;
  to: string;
  /** Aggregate by PUC level (1 Clase … 5 Auxiliar); detail per account when omitted. */
  level?: AccountLevel;
}

/**
 * Trial balance (§3.5): opening balance, period debits/credits and closing
 * balance per account, only posted entries within the range. Fixes bug 2
 * (the legacy summed every line regardless of status and dates) and adds
 * opening balances and level aggregation (bug 12).
 */
@Injectable()
export class GetTrialBalanceUseCase implements UseCase<GetTrialBalanceInput, TrialBalanceView> {
  constructor(private readonly reader: LedgerReader) {}

  async execute(input: GetTrialBalanceInput): Promise<TrialBalanceView> {
    const { from, to } = parseRange(input.from, input.to);
    const ledgerRows = await this.reader.rows({ from, to, level: input.level });
    const rows: TrialBalanceRowView[] = ledgerRows.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      level: row.level,
      openingBalance: toAmount(row.opening),
      debit: toAmount(row.debit),
      credit: toAmount(row.credit),
      closingBalance: toAmount(row.closing),
      debitBalance: toAmount(Math.max(row.closing, 0)),
      creditBalance: toAmount(Math.max(-row.closing, 0)),
    }));
    const cents = ledgerRows.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
        debitBalance: acc.debitBalance + Math.max(row.closing, 0),
        creditBalance: acc.creditBalance + Math.max(-row.closing, 0),
      }),
      { debit: 0, credit: 0, debitBalance: 0, creditBalance: 0 },
    );
    return {
      from,
      to,
      level: input.level ?? null,
      rows,
      totals: {
        debit: toAmount(cents.debit),
        credit: toAmount(cents.credit),
        debitBalance: toAmount(cents.debitBalance),
        creditBalance: toAmount(cents.creditBalance),
      },
      balanced: cents.debit === cents.credit && cents.debitBalance === cents.creditBalance,
    };
  }
}
