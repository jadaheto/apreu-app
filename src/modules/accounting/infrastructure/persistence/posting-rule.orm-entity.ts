import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Mapping of `accounting_posting_rules` (migration accounting-001). */
@Entity({ name: 'accounting_posting_rules' })
export class PostingRuleOrmEntity {
  @PrimaryColumn({ name: 'rule_key', type: 'varchar', length: 100 })
  ruleKey: string;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
