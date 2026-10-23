import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimal } from './column-transformers.js';

/** Mapping of `employees` (baseline + migration hr-001). */
@Entity({ name: 'employees' })
export class EmployeeOrmEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'document_type', type: 'varchar', length: 10, nullable: true, default: 'cc' })
  documentType: string | null;

  @Column({ name: 'document_number', type: 'varchar', length: 30, unique: true })
  documentNumber: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'M' })
  gender: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({
    name: 'employee_type',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'docente',
  })
  employeeType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'active',
  })
  status: string | null;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: string | null;

  @Column({ name: 'retirement_date', type: 'date', nullable: true })
  retirementDate: string | null;

  @Column({ name: 'retirement_reason', type: 'varchar', length: 255, nullable: true })
  retirementReason: string | null;

  @Column({
    name: 'contract_type',
    type: 'varchar',
    length: 10,
    nullable: true,
    default: 'indefinido',
  })
  contractType: string | null;

  @Column({ name: 'base_salary', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: decimal })
  baseSalary: number;

  @Column({ name: 'integral_salary', type: 'boolean', default: false })
  integralSalary: boolean;

  @Column({ name: 'fixed_libranza', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  fixedLibranza: number;

  @Column({ name: 'fixed_sindicato', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  fixedSindicato: number;

  @Column({ name: 'fixed_embargo', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  fixedEmbargo: number;

  @Column({ name: 'embargo_alimony', type: 'boolean', default: false })
  embargoAlimony: boolean;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount: string | null;

  @Column({ name: 'account_type', type: 'varchar', length: 10, nullable: true, default: 'ahorros' })
  accountType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  eps: string | null;

  @Column({ name: 'pension_fund', type: 'varchar', length: 100, nullable: true })
  pensionFund: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  arl: string | null;

  @Column({ name: 'arl_risk_class', type: 'smallint', default: 1 })
  arlRiskClass: number;

  @Column({ name: 'withholding_dependents', type: 'boolean', default: false })
  withholdingDependents: boolean;

  @Column({
    name: 'withholding_prepaid_health',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimal,
  })
  withholdingPrepaidHealth: number;

  @Column({
    name: 'withholding_housing_interest',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimal,
  })
  withholdingHousingInterest: number;

  @Column({ name: 'voluntary_pension', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: decimal })
  voluntaryPension: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date | null;
}
