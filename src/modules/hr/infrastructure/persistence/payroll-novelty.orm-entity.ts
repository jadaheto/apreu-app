import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './column-transformers.js';

/** Mapping of `payroll_novelties` (migration hr-001). */
@Entity({ name: 'payroll_novelties' })
export class PayrollNoveltyOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'payroll_period_id', type: 'integer' })
  payrollPeriodId: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimal })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
