import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { POSTING_RULE_KEY_DEFINITIONS } from '../domain/posting-rule.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';

export interface PostingRuleView {
  key: string;
  accountId: number;
  accountCode: string | null;
  accountName: string | null;
}

export interface PostingRulesView {
  /** Supported key patterns with an example and description. */
  supportedKeys: { example: string; description: string }[];
  rules: PostingRuleView[];
}

/** Current account parametrization of automatic entries. */
@Injectable()
export class ListPostingRulesUseCase implements UseCase<void, PostingRulesView> {
  constructor(
    @Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(): Promise<PostingRulesView> {
    const rules = await this.rules.findAll();
    const accounts = new Map(
      (rules.length ? await this.accounts.findByIds(rules.map((rule) => rule.accountId)) : []).map((a) => [a.id, a]),
    );
    return {
      supportedKeys: POSTING_RULE_KEY_DEFINITIONS.map(({ example, description }) => ({ example, description })),
      rules: rules
        .map((rule) => ({
          key: rule.key,
          accountId: rule.accountId,
          accountCode: accounts.get(rule.accountId)?.code.toString() ?? null,
          accountName: accounts.get(rule.accountId)?.name ?? null,
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
