import type { PostingRule } from './posting-rule.js';

/** Output port for the account parametrization of automatic entries. */
export interface PostingRuleRepository {
  findAll(): Promise<PostingRule[]>;
  save(rule: PostingRule, updatedBy: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export const POSTING_RULE_REPOSITORY = Symbol('PostingRuleRepository');
