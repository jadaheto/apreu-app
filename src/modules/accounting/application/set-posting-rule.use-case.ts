import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { parsePostingRuleKey } from '../domain/posting-rule.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';
import type { PostingRuleView } from './list-posting-rules.use-case.js';

export interface SetPostingRuleInput {
  key: string;
  accountId: number;
  actor: AuthenticatedActor;
}

/** Maps a rule key to a transactional account (creates or replaces the rule). */
@Injectable()
export class SetPostingRuleUseCase implements UseCase<SetPostingRuleInput, PostingRuleView> {
  constructor(
    @Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute({ key, accountId, actor }: SetPostingRuleInput): Promise<PostingRuleView> {
    const ruleKey = parsePostingRuleKey(key);
    const account = await this.accounts.findById(accountId);
    if (!account) throw new NotFoundError('Cuenta contable', accountId);
    if (!account.isTransactional) {
      throw new BusinessRuleViolationError(
        'Sólo se pueden parametrizar cuentas de movimiento.',
        'ACCOUNT_NOT_TRANSACTIONAL',
      );
    }
    await this.rules.save({ key: ruleKey, accountId }, actor.userId);
    return { key: ruleKey, accountId, accountCode: account.code.toString(), accountName: account.name };
  }
}
