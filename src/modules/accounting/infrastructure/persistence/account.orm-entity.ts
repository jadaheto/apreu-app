import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { AccountType } from '../../domain/account-type.js';

/** Mapping of `accounting_accounts`. */
@Entity({ name: 'accounting_accounts' })
export class AccountOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  type: AccountType;

  @Column({ name: 'is_transactional', type: 'boolean', default: false })
  isTransactional: boolean;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
