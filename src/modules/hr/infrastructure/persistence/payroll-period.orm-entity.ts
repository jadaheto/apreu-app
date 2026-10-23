import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './column-transformers.js';

/** Mapping of `payroll_periods` (baseline + migration hr-001). */
@Entity({ name: 'payroll_periods' })
export class PayrollPeriodOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ type: 'varchar', length: 10, default: 'monthly' })
  frequency: string;

  @Column({ name: 'total_gross', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  totalGross: number;

  @Column({ name: 'total_deductions', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  totalDeductions: number;

  @Column({ name: 'total_net', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: decimal })
  totalNet: number;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'draft',
  })
  status: string | null;

  @Column({ name: 'period_label', type: 'varchar', length: 100, nullable: true })
  periodLabel: string | null;

  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @Column({ name: 'calculated_by', type: 'integer', nullable: true })
  calculatedBy: number | null;

  @Column({ name: 'calculated_at', type: 'timestamptz', nullable: true })
  calculatedAt: Date | null;

  @Column({ name: 'approved_by', type: 'integer', nullable: true })
  approvedBy: number | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', length: 255, nullable: true })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
