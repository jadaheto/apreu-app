import { Inject, Injectable } from '@nestjs/common';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import type { AccountingPeriod } from '../domain/accounting-period.js';
import {
  ACCOUNTING_PERIOD_REPOSITORY,
  type AccountingPeriodRepository,
} from '../domain/accounting-period.repository.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { JournalEntryPolicy } from '../domain/journal-entry-policy.js';
import type { JournalEntry } from '../domain/journal-entry.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { THIRD_PARTY_REPOSITORY, type ThirdPartyRepository } from '../domain/third-party.repository.js';
import { VOUCHER_SEQUENCE, type VoucherSequencePort } from './ports/voucher-sequence.port.js';

/**
 * Application service shared by every use case that stores or books journal
 * entries (manual, reversals and automatic). Loads the aggregates referenced
 * by the entry and applies {@link JournalEntryPolicy}; posting assigns the
 * locked consecutive. Callers run it inside a unit of work so header, lines
 * and consecutive are atomic (bug 5).
 */
@Injectable()
export class JournalEntryBooker {
  constructor(
    @Inject(ACCOUNTING_PERIOD_REPOSITORY) private readonly periods: AccountingPeriodRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(THIRD_PARTY_REPOSITORY) private readonly thirdParties: ThirdPartyRepository,
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(VOUCHER_SEQUENCE) private readonly sequence: VoucherSequencePort,
  ) {}

  /**
   * Open period that contains the day (RN-JE-09: inferred when the user does
   * not choose one). Fails when there is none.
   */
  async openPeriodFor(day: string): Promise<AccountingPeriod> {
    const period = (await this.periods.findContaining(day)).find((candidate) => candidate.isOpen);
    if (!period) {
      throw new BusinessRuleViolationError(
        `No hay un periodo contable abierto que contenga la fecha ${day}.`,
        'NO_OPEN_PERIOD',
      );
    }
    return period;
  }

  /** Validates references and saves the entry as a draft. */
  async saveDraft(entry: JournalEntry): Promise<void> {
    await this.assertBookable(entry);
    await this.entries.save(entry);
  }

  /** Validates, assigns the next consecutive, posts and saves the entry. */
  async post(entry: JournalEntry, by: number | null, at: Date): Promise<void> {
    await this.assertBookable(entry);
    entry.post(await this.sequence.next(entry.type), by, at);
    await this.entries.save(entry);
  }

  private async assertBookable(entry: JournalEntry): Promise<void> {
    const accountIds = [...new Set(entry.lines.map((line) => line.accountId))];
    const thirdPartyIds = [
      ...new Set(entry.lines.map((line) => line.thirdPartyId).filter((id): id is number => id !== null)),
    ];
    const [period, accounts, thirdParties] = await Promise.all([
      this.periods.findById(entry.periodId),
      this.accounts.findByIds(accountIds),
      thirdPartyIds.length ? this.thirdParties.findByIds(thirdPartyIds) : Promise.resolve([]),
    ]);
    JournalEntryPolicy.assertBookable(entry, {
      period,
      accounts: new Map(accounts.map((account) => [account.id as number, account])),
      thirdParties: new Map(thirdParties.map((party) => [party.id as number, party])),
    });
  }
}
