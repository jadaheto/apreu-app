import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { Ledger, type LedgerRow } from '../domain/ledger.js';
import { toAuxiliaryLines } from './auxiliary-lines.js';
import { LedgerReader, parseRange, toAmount } from './ledger-reader.js';
import { LEDGER_QUERY, type LedgerQueryPort } from './ports/ledger-query.port.js';
import type { GeneralLedgerView, NaturalBalanceRowView } from './report-views.js';

export interface GetGeneralLedgerInput {
  from: string;
  to: string;
  /** Single account (aggregating its sub-accounts) with detailed movements. */
  accountId?: number;
}

const toNaturalRow = (row: LedgerRow): NaturalBalanceRowView => ({
  code: row.code,
  name: row.name,
  nature: row.nature,
  openingBalance: toAmount(Ledger.naturalBalance(row.opening, row.nature)),
  debit: toAmount(row.debit),
  credit: toAmount(row.credit),
  closingBalance: toAmount(Ledger.naturalBalance(row.closing, row.nature)),
});

/**
 * General ledger ("libro mayor", missing in the legacy): by 4-digit account
 * (level Cuenta) — or for one selected account — opening balance, period
 * debits/credits and closing balance according to nature.
 */
@Injectable()
export class GetGeneralLedgerUseCase implements UseCase<GetGeneralLedgerInput, GeneralLedgerView> {
  constructor(
    private readonly reader: LedgerReader,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(LEDGER_QUERY) private readonly ledger: LedgerQueryPort,
  ) {}

  async execute(input: GetGeneralLedgerInput): Promise<GeneralLedgerView> {
    const { from, to } = parseRange(input.from, input.to);
    if (input.accountId === undefined) {
      const rows = await this.reader.rows({ from, to, level: 3 });
      return { from, to, rows: rows.map(toNaturalRow), lines: null };
    }
    const account = await this.accounts.findById(input.accountId);
    if (!account) throw new NotFoundError('Cuenta contable', input.accountId);
    const scope = await this.reader.withDescendants(account);
    const rows = await this.reader.rows({ from, to, accounts: scope, level: account.level });
    const opening = rows.reduce((acc, row) => acc + row.opening, 0);
    const lines = await this.ledger.lines({ from, to, accountIds: scope.map((a) => a.id as number) });
    return {
      from,
      to,
      rows: rows.map(toNaturalRow),
      lines: toAuxiliaryLines(lines, account.nature, Ledger.naturalBalance(opening, account.nature)),
    };
  }
}
