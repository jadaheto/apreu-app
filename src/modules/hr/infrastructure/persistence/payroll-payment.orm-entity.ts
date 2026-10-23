import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './column-transformers.js';

/** Mapping of `payroll_payments` (baseline + migration hr-001). */
@Entity({ name: 'payroll_payments' })
export class PayrollPaymentOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'employee_id', type: 'integer' })
  employeeId: number;

  @Column({ name: 'payroll_period_id', type: 'integer' })
  payrollPeriodId: number;

  @Column({ name: 'worked_days', type: 'smallint', default: 30 })
  workedDays: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  ibc: number;

  @Column({ name: 'base_salary', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  baseSalary: number;

  @Column({ name: 'leave_pay', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  leavePay: number;

  @Column({ name: 'transport_allowance', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  transportAllowance: number;

  @Column({ name: 'overtime_pay', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  overtimePay: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  bonuses: number;

  @Column({ name: 'gross_salary', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  grossSalary: number;

  @Column({ name: 'pension_deduction', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  pensionDeduction: number;

  @Column({ name: 'health_deduction', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  healthDeduction: number;

  @Column({
    name: 'solidarity_fund_deduction',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimal,
  })
  solidarityFundDeduction: number;

  @Column({ name: 'libranza_deduction', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  libranzaDeduction: number;

  @Column({ name: 'sindicato_deduction', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  sindicatoDeduction: number;

  @Column({ name: 'embargo_deduction', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  embargoDeduction: number;

  @Column({ name: 'other_deductions', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  otherDeductions: number;

  @Column({ name: 'income_tax', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  incomeTax: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  retefuente: number;

  @Column({ name: 'sena_contribution', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  senaContribution: number;

  @Column({ name: 'icbf_contribution', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  icbfContribution: number;

  @Column({ name: 'ccf_contribution', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  ccfContribution: number;

  @Column({ name: 'arl_contribution', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  arlContribution: number;

  @Column({ name: 'employer_health', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  employerHealth: number;

  @Column({ name: 'employer_pension', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  employerPension: number;

  @Column({ name: 'total_employer_cost', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  totalEmployerCost: number;

  @Column({ name: 'total_deductions', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  totalDeductions: number;

  @Column({ name: 'net_salary', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  netSalary: number;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'pending' })
  status: string | null;

  @Column({ name: 'calculation_notes', type: 'jsonb', nullable: true })
  calculationNotes: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
