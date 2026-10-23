import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { type ChargeStatus } from '../../domain/student-charge.js';

/**
 * Mapping of `student_charges`. `billing_period` is added by migration
 * `finance-002`; legacy rows without it fall back to the due-date month.
 */
@Entity({ name: 'student_charges' })
export class StudentChargeOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  @Column({ name: 'concept_id', type: 'integer' })
  conceptId: number;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'tax_rate', type: 'numeric', precision: 5, scale: 2, nullable: true, default: 0 })
  taxRate: string | null;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 12, scale: 2, nullable: true, default: 0 })
  taxAmount: string | null;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 12, scale: 2, nullable: true, default: 0 })
  discountAmount: string | null;

  @Column({ name: 'net_amount', type: 'numeric', precision: 12, scale: 2 })
  netAmount: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'billing_period', type: 'char', length: 7, nullable: true })
  billingPeriod: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'pending' })
  status: ChargeStatus | null;

  @Column({ name: 'academic_year', type: 'smallint' })
  academicYear: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
