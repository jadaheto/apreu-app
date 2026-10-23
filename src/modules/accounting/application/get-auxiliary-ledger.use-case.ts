import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { Ledger } from '../domain/ledger.js';
import { toAccountView } from './account-view.js';
import { toAuxiliaryLines } from './auxiliary-lines.js';
import { LedgerReader, parseRange, toAmount } from './ledger-reader.js';
import { LEDGER_QUERY, type LedgerQueryPort } from './ports/ledger-query.port.js';
import type { AuxiliaryLedgerView } from './report-views.js';

export interface GetAuxiliaryLedgerInput {
  from: string;
  to: string;
  accountId: number;
  thirdPartyId?: number;
}

/**
 * Auxiliary ledger per account (and optionally per third party): opening
 * balance before `from` plus each posted line with the line detail, third
 * party and running balance by nature (legacy `reports.php?type=auxiliary`,
 * bug 12).
 */
@Injectable()
export class GetAuxiliaryLedgerUseCase implements UseCase<GetAuxiliaryLedgerInput, AuxiliaryLedgerView> {
  constructor(
    private readonly reader: LedgerReader,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(LEDGER_QUERY) private readonly ledger: LedgerQueryPort,
  ) {}

  async execute(input: GetAuxiliaryLedgerInput): Promise<AuxiliaryLedgerView> {
    const { from, to } = parseRange(input.from, input.to);
    const account = await this.accounts.findById(input.accountId);
    if (!account) throw new NotFoundError('Cuenta contable', input.accountId);
    const scope = await this.reader.withDescendants(account);
    const accountIds = scope.map((a) => a.id as number);
    const rows = await this.reader.rows({ from, to, accounts: scope, thirdPartyId: input.thirdPartyId });
    const openingCents = Ledger.naturalBalance(
      rows.reduce((acc, row) => acc + row.opening, 0),
      account.nature,
    );
    const lines = toAuxiliaryLines(
      await this.ledger.lines({ from, to, accountIds, thirdPartyId: input.thirdPartyId }),
      account.nature,
      openingCents,
    );
    const debit = rows.reduce((acc, row) => acc + row.debit, 0);
    const credit = rows.reduce((acc, row) => acc + row.credit, 0);
    return {
      from,
      to,
      account: toAccountView(account),
      thirdPartyId: input.thirdPartyId ?? null,
      openingBalance: toAmount(openingCents),
      lines,
      totals: { debit: toAmount(debit), credit: toAmount(credit) },
      closingBalance: toAmount(openingCents + Ledger.naturalBalance(debit - credit, account.nature)),
    };
  }
}
