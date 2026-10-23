import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { JournalEntryStatus } from '../../domain/journal-entry.js';
import type { VoucherType } from '../../domain/voucher-type.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';

/** Mapping of `accounting_journal_entries` (+ audit/source columns of migration accounting-001). */
@Entity({ name: 'accounting_journal_entries' })
export class JournalEntryOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'period_id', type: 'integer' })
  periodId: number;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({ name: 'entry_type', type: 'varchar', length: 10 })
  entryType: VoucherType;

  @Column({ name: 'entry_number', type: 'varchar', length: 50 })
  entryNumber: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'total_debit', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalDebit: string;

  @Column({ name: 'total_credit', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalCredit: string;

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status: JournalEntryStatus;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'posted_by', type: 'integer', nullable: true })
  postedBy: number | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'voided_by', type: 'integer', nullable: true })
  voidedBy: number | null;

  @Column({ name: 'void_reason', type: 'varchar', length: 255, nullable: true })
  voidReason: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 50, nullable: true })
  sourceType: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 50, nullable: true })
  sourceId: string | null;

  @Column({ name: 'reversal_of_id', type: 'integer', nullable: true })
  reversalOfId: number | null;

  @OneToMany(() => JournalLineOrmEntity, (line) => line.entry)
  lines: JournalLineOrmEntity[];
}
