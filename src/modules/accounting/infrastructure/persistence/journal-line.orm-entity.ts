import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { JournalEntryOrmEntity } from './journal-entry.orm-entity.js';

/** Mapping of `accounting_journal_lines`. */
@Entity({ name: 'accounting_journal_lines' })
export class JournalLineOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @ManyToOne('JournalEntryOrmEntity', 'lines', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry?: JournalEntryOrmEntity;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ name: 'third_party_id', type: 'integer', nullable: true })
  thirdPartyId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  debit: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  credit: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
