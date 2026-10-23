import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { decimal } from './column-transformers.js';

/** Mapping of `payroll_parameters` (migration hr-001). */
@Entity({ name: 'payroll_parameters' })
export class PayrollParametersOrmEntity {
  @PrimaryColumn({ type: 'smallint' })
  year: number;

  @Column({ name: 'minimum_wage', type: 'numeric', precision: 12, scale: 2, transformer: decimal })
  minimumWage: number;

  @Column({ name: 'transport_allowance', type: 'numeric', precision: 12, scale: 2, transformer: decimal })
  transportAllowance: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: decimal })
  uvt: number;

  @Column({ type: 'jsonb' })
  rates: Record<string, unknown>;

  @Column({ name: 'employer_contribution_exemption', type: 'boolean', default: false })
  employerContributionExemption: boolean;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
