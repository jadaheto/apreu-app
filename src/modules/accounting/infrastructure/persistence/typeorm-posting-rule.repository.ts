import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { PostingRule } from '../../domain/posting-rule.js';
import type { PostingRuleRepository } from '../../domain/posting-rule.repository.js';
import { PostingRuleOrmEntity } from './posting-rule.orm-entity.js';

@Injectable()
export class TypeOrmPostingRuleRepository implements PostingRuleRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findAll(): Promise<PostingRule[]> {
    const rows = await (await this.db.repository(PostingRuleOrmEntity)).find({ order: { ruleKey: 'ASC' } });
    return rows.map((row) => ({ key: row.ruleKey, accountId: row.accountId }));
  }

  async save(rule: PostingRule, updatedBy: number): Promise<void> {
    await (
      await this.db.repository(PostingRuleOrmEntity)
    ).upsert({ ruleKey: rule.key, accountId: rule.accountId, updatedBy }, ['ruleKey']);
  }

  async delete(key: string): Promise<void> {
    await (await this.db.repository(PostingRuleOrmEntity)).delete({ ruleKey: key });
  }
}
