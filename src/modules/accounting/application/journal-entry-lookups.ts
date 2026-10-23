import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import type { JournalEntry } from '../domain/journal-entry.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import type { LineLookups } from './journal-entry-view.js';

/** Loads the accounts and third parties referenced by entries to render their lines. */
@Injectable()
export class JournalEntryLookups {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository,
  ) {}

  async for(entries: readonly JournalEntry[]): Promise<LineLookups> {
    const lines = entries.flatMap((entry) => entry.lines);
    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const thirdPartyIds = [
      ...new Set(lines.map((line) => line.thirdPartyId).filter((id): id is number => id !== null)),
    ];
    const [accounts, thirdParties] = await Promise.all([
      accountIds.length ? this.accounts.findByIds(accountIds) : Promise.resolve([]),
      thirdPartyIds.length ? this.thirdParties.findByIds(thirdPartyIds) : Promise.resolve([]),
    ]);
    return {
      accounts: new Map(accounts.map((account) => [account.id as number, account])),
      thirdParties: new Map(thirdParties.map((party) => [party.id as number, party])),
    };
  }
}
