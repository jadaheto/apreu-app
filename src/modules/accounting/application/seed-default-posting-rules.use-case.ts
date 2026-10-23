import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { DEFAULT_POSTING_RULES } from '../domain/default-posting-rules.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';
import { SeedStandardPucUseCase } from './seed-standard-puc.use-case.js';

export interface SeedDefaultPostingRulesOutput {
  /** PUC accounts inserted because the chart of accounts lacked them. */
  accountsInserted: number;
  /** Rule keys created with their default account. */
  created: string[];
  /** Rule keys already parametrized by the school (never overwritten). */
  kept: string[];
  /** Rule keys whose default account was deleted or turned into a summary account. */
  unavailable: { key: string; accountCode: string }[];
}

/**
 * Loads the default parametrization of automatic entries
 * ({@link DEFAULT_POSTING_RULES}) so a new school gets its receipts, expenses
 * and payroll booked without manual setup. First loads the missing accounts
 * of the standard PUC. Idempotent: existing rules and accounts are left
 * untouched; runs in a single transaction.
 */
@Injectable()
export class SeedDefaultPostingRulesUseCase implements UseCase<AuthenticatedActor, SeedDefaultPostingRulesOutput> {
  constructor(
    private readonly seedPuc: SeedStandardPucUseCase,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  execute(actor: AuthenticatedActor): Promise<SeedDefaultPostingRulesOutput> {
    return this.uow.runInTransaction(async () => {
      const { inserted } = await this.seedPuc.execute();
      const configured = new Set((await this.rules.findAll()).map((rule) => rule.key));
      const byCode = new Map((await this.accounts.findAll()).map((account) => [account.code.toString(), account]));
      const output: SeedDefaultPostingRulesOutput = {
        accountsInserted: inserted,
        created: [],
        kept: [],
        unavailable: [],
      };

      for (const { key, accountCode } of DEFAULT_POSTING_RULES) {
        if (configured.has(key)) {
          output.kept.push(key);
          continue;
        }
        const account = byCode.get(accountCode);
        if (!account?.isTransactional) {
          output.unavailable.push({ key, accountCode });
          continue;
        }
        await this.rules.save({ key, accountId: account.id as number }, actor.userId);
        output.created.push(key);
      }
      return output;
    });
  }
}
