import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { parsePostingRuleKey } from '../domain/posting-rule.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';

/** Removes a rule; events needing it will be skipped with a warning until it is configured again. */
@Injectable()
export class DeletePostingRuleUseCase implements UseCase<string, void> {
  constructor(@Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository) {}

  async execute(key: string): Promise<void> {
    await this.rules.delete(parsePostingRuleKey(key));
  }
}
