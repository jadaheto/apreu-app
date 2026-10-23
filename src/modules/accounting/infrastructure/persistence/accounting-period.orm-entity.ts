import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { PeriodStatus } from '../../domain/accounting-period.js';

/** Mapping of `accounting_periods` (+ audit columns of migration accounting-001). */
@Entity({ name: 'accounting_periods' })
export class AccountingPeriodOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: PeriodStatus;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'closed_by', type: 'integer', nullable: true })
  closedBy: number | null;

  @Column({ name: 'reopened_at', type: 'timestamptz', nullable: true })
  reopenedAt: Date | null;

  @Column({ name: 'reopened_by', type: 'integer', nullable: true })
  reopenedBy: number | null;

  @Column({ name: 'reopen_reason', type: 'varchar', length: 255, nullable: true })
  reopenReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
