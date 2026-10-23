import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { CalendarDate, type IsoDate } from '../common/calendar-date.js';
import {
  ARL_RISK_CLASSES,
  BANK_ACCOUNT_TYPES,
  CONTRACT_TYPES,
  DOCUMENT_TYPES,
  EMPLOYEE_TYPES,
  GENDERS,
  STATUS_TRANSITIONS,
  STATUSES_WITH_ACCESS,
  type ArlRiskClass,
  type BankAccountType,
  type ContractType,
  type DocumentType,
  type EmployeeStatus,
  type EmployeeType,
  type Gender,
} from './employee-catalogs.js';

/** Monthly amounts HR deducts every payroll (libranza, cuota sindical, embargo). */
export interface RecurringDeductions {
  libranza: Money;
  sindicato: Money;
  embargo: Money;
  /** Embargo por alimentos: allows up to 50 % instead of 1/5 of the excess over the SMMLV. */
  embargoIsAlimony: boolean;
}

/** Monthly information used by the withholding tax (procedimiento 1, art. 387 ET). */
export interface WithholdingInfo {
  hasDependents: boolean;
  prepaidHealth: Money;
  housingInterest: Money;
  /** Aportes voluntarios a pensión / AFC (renta exenta). */
  voluntaryPension: Money;
}

export interface EmployeeProps {
  userId: number | null;
  code: string;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate: IsoDate | null;
  gender: Gender;
  phone: string | null;
  email: Email | null;
  address: string | null;
  employeeType: EmployeeType;
  position: string | null;
  department: string | null;
  status: EmployeeStatus;
  hireDate: IsoDate | null;
  contractType: ContractType;
  baseSalary: Money;
  integralSalary: boolean;
  recurringDeductions: RecurringDeductions;
  bankName: string | null;
  bankAccount: string | null;
  accountType: BankAccountType;
  eps: string | null;
  pensionFund: string | null;
  arl: string | null;
  arlRiskClass: ArlRiskClass;
  withholding: WithholdingInfo;
  retirementDate: IsoDate | null;
  retirementReason: string | null;
  createdAt: Date | null;
}

/** Data HR captures in the employee form (3-step wizard of `hr/employees.php`). */
export interface EmployeeData {
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate?: string | null;
  gender: Gender;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  employeeType: EmployeeType;
  position?: string | null;
  department?: string | null;
  hireDate?: string | null;
  contractType: ContractType;
  baseSalary: number;
  integralSalary?: boolean;
  fixedLibranza?: number;
  fixedSindicato?: number;
  fixedEmbargo?: number;
  embargoIsAlimony?: boolean;
  bankName?: string | null;
  bankAccount?: string | null;
  accountType?: BankAccountType;
  eps?: string | null;
  pensionFund?: string | null;
  arl?: string | null;
  arlRiskClass?: number;
  withholdingDependents?: boolean;
  withholdingPrepaidHealth?: number;
  withholdingHousingInterest?: number;
  voluntaryPension?: number;
}

/** Contact data the employee may change through self-service. */
export interface ContactInfo {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/** Inclusive window of days the employee has a labour contract inside a payroll period. */
export interface ContractWindow {
  from: IsoDate;
  to: IsoDate;
}

type ProfileProps = Omit<
  EmployeeProps,
  'userId' | 'code' | 'status' | 'retirementDate' | 'retirementReason' | 'createdAt'
>;

/**
 * Staff member of the school (`employees`). Aggregate root of the HR context.
 *
 * Rules (analysis 07 §4.1 and §6.2):
 * - Names, document and a positive base salary are mandatory.
 * - Status changes follow {@link STATUS_TRANSITIONS}; retirement is logical
 *   (date + reason), never a physical delete (fixes B-27).
 * - Contractors (`prestacion`) are not part of the payroll (L-12).
 */
export class Employee extends Entity<EmployeeProps> {
  private constructor(id: EntityId, props: EmployeeProps) {
    super(id, props);
  }

  static create(code: string, data: EmployeeData): Employee {
    const trimmedCode = code?.trim();
    Guard.againstEmpty(trimmedCode, 'código');
    Guard.againstMaxLength(trimmedCode, 20, 'código');
    return new Employee(null, {
      ...Employee.validateProfile(data),
      userId: null,
      code: trimmedCode,
      status: 'active',
      retirementDate: null,
      retirementReason: null,
      createdAt: null,
    });
  }

  /** Rebuilds a persisted employee without re-running creation rules (legacy data may be incomplete). */
  static restore(id: number, props: EmployeeProps): Employee {
    return new Employee(id, { ...props });
  }

  get userId(): number | null {
    return this.props.userId;
  }
  get code(): string {
    return this.props.code;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim();
  }
  get documentType(): DocumentType {
    return this.props.documentType;
  }
  get documentNumber(): string {
    return this.props.documentNumber;
  }
  get birthDate(): IsoDate | null {
    return this.props.birthDate;
  }
  get gender(): Gender {
    return this.props.gender;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get email(): Email | null {
    return this.props.email;
  }
  get address(): string | null {
    return this.props.address;
  }
  get employeeType(): EmployeeType {
    return this.props.employeeType;
  }
  get position(): string | null {
    return this.props.position;
  }
  get department(): string | null {
    return this.props.department;
  }
  get status(): EmployeeStatus {
    return this.props.status;
  }
  get hireDate(): IsoDate | null {
    return this.props.hireDate;
  }
  get contractType(): ContractType {
    return this.props.contractType;
  }
  get baseSalary(): Money {
    return this.props.baseSalary;
  }
  get integralSalary(): boolean {
    return this.props.integralSalary;
  }
  get recurringDeductions(): RecurringDeductions {
    return { ...this.props.recurringDeductions };
  }
  get bankName(): string | null {
    return this.props.bankName;
  }
  get bankAccount(): string | null {
    return this.props.bankAccount;
  }
  get accountType(): BankAccountType {
    return this.props.accountType;
  }
  get eps(): string | null {
    return this.props.eps;
  }
  get pensionFund(): string | null {
    return this.props.pensionFund;
  }
  get arl(): string | null {
    return this.props.arl;
  }
  get arlRiskClass(): ArlRiskClass {
    return this.props.arlRiskClass;
  }
  get withholding(): WithholdingInfo {
    return { ...this.props.withholding };
  }
  get retirementDate(): IsoDate | null {
    return this.props.retirementDate;
  }
  get retirementReason(): string | null {
    return this.props.retirementReason;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Contractors (prestación de servicios) are paid outside the payroll. */
  get isContractor(): boolean {
    return this.props.contractType === 'prestacion';
  }

  /** Whether the linked user may sign in to the employee portal. */
  get hasPortalAccess(): boolean {
    return STATUSES_WITH_ACCESS.includes(this.props.status);
  }

  /** Salario integral must be at least 13 SMMLV (art. 132 CST: 10 SMMLV + 30 % factor prestacional). */
  assertIntegralSalaryMinimum(minimumWage: Money): void {
    if (this.props.integralSalary && this.props.baseSalary.isLessThan(minimumWage.multiply(13))) {
      throw new BusinessRuleViolationError(
        `El salario integral no puede ser inferior a 13 SMMLV (${minimumWage.multiply(13).format()}).`,
        'INTEGRAL_SALARY_TOO_LOW',
      );
    }
  }

  /** Replaces every HR-managed field (personal, contract, bank, social security, deductions). */
  updateProfile(data: EmployeeData): void {
    Object.assign(this.props, Employee.validateProfile(data));
  }

  /**
   * Self-service update. Only contact data can change; deductions and bank
   * account are HR-only (fixes legacy S-4, `hr/portal.php:126-132`).
   */
  updateContactInfo(info: ContactInfo): void {
    if (info.phone !== undefined) this.props.phone = optionalText(info.phone, 20, 'celular');
    if (info.address !== undefined) this.props.address = optionalText(info.address, 500, 'dirección');
    if (info.email !== undefined) this.props.email = info.email?.trim() ? Email.create(info.email) : null;
  }

  linkUser(userId: number): void {
    this.props.userId = userId;
  }

  /** Applies a status change following {@link STATUS_TRANSITIONS}. */
  changeStatus(target: EmployeeStatus): void {
    if (target === this.props.status) return;
    if (!STATUS_TRANSITIONS[this.props.status].includes(target)) {
      throw new BusinessRuleViolationError(
        target === 'retired'
          ? 'Para retirar a un empleado use el retiro con fecha y motivo.'
          : `No se puede pasar de "${this.props.status}" a "${target}".`,
        'INVALID_STATUS_TRANSITION',
        { from: this.props.status, to: target },
      );
    }
    this.props.status = target;
  }

  /** Logical retirement: keeps payroll, leave and certificate history. */
  retire(date: string, reason: string): void {
    if (this.props.status === 'retired') {
      throw new BusinessRuleViolationError('El empleado ya está retirado.', 'ALREADY_RETIRED');
    }
    const retirementDate = CalendarDate.assert(date, 'fecha de retiro');
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo de retiro');
    Guard.againstMaxLength(trimmed, 255, 'motivo de retiro');
    if (this.props.hireDate && retirementDate < this.props.hireDate) {
      throw new BusinessRuleViolationError(
        'La fecha de retiro no puede ser anterior a la fecha de ingreso.',
        'INVALID_RETIREMENT_DATE',
      );
    }
    this.props.status = 'retired';
    this.props.retirementDate = retirementDate;
    this.props.retirementReason = trimmed;
  }

  /**
   * Days of the period covered by the labour contract, or `null` when the
   * employee is not part of this payroll (analysis L-7, L-12, L-13, L-14):
   * contractors never; active and on-leave employees yes; retired employees
   * until their retirement date; inactive/suspended employees no.
   */
  payrollWindow(periodStart: IsoDate, periodEnd: IsoDate): ContractWindow | null {
    if (this.isContractor) return null;
    const status = this.props.status;
    const retiredInsidePeriod =
      status === 'retired' && !!this.props.retirementDate && this.props.retirementDate >= periodStart;
    if (!STATUSES_WITH_ACCESS.includes(status) && !retiredInsidePeriod) return null;
    const from = this.props.hireDate ? CalendarDate.max(periodStart, this.props.hireDate) : periodStart;
    const to = retiredInsidePeriod ? CalendarDate.min(periodEnd, this.props.retirementDate as IsoDate) : periodEnd;
    return from <= to ? { from, to } : null;
  }

  private static validateProfile(data: EmployeeData): ProfileProps {
    const firstName = requiredText(data.firstName, 100, 'nombres');
    const lastName = requiredText(data.lastName, 100, 'apellidos');
    const documentNumber = requiredText(data.documentNumber, 30, 'número de documento');
    if (!/^[A-Za-z0-9-]+$/.test(documentNumber)) {
      throw new BusinessRuleViolationError(
        'El número de documento solo admite letras, números y guiones.',
        'INVALID_DOCUMENT',
      );
    }
    Guard.oneOf(data.documentType, DOCUMENT_TYPES, 'tipo de documento');
    Guard.oneOf(data.gender, GENDERS, 'género');
    Guard.oneOf(data.employeeType, EMPLOYEE_TYPES, 'tipo de empleado');
    Guard.oneOf(data.contractType, CONTRACT_TYPES, 'tipo de contrato');
    const accountType = data.accountType ?? 'ahorros';
    Guard.oneOf(accountType, BANK_ACCOUNT_TYPES, 'tipo de cuenta');
    const arlRiskClass = (data.arlRiskClass ?? 1) as ArlRiskClass;
    Guard.oneOf(arlRiskClass, ARL_RISK_CLASSES, 'clase de riesgo ARL');

    const baseSalary = Money.of(data.baseSalary);
    if (!baseSalary.isGreaterThan(Money.zero())) {
      throw new BusinessRuleViolationError('El salario base debe ser mayor que cero.', 'INVALID_SALARY');
    }
    const birthDate = CalendarDate.assertOptional(data.birthDate, 'fecha de nacimiento');
    const hireDate = CalendarDate.assertOptional(data.hireDate, 'fecha de ingreso');
    if (birthDate && hireDate && hireDate <= birthDate) {
      throw new BusinessRuleViolationError(
        'La fecha de ingreso debe ser posterior al nacimiento.',
        'INVALID_HIRE_DATE',
      );
    }
    const bankAccount = optionalText(data.bankAccount, 50, 'número de cuenta');
    if (bankAccount && !/^[0-9-]+$/.test(bankAccount)) {
      throw new BusinessRuleViolationError(
        'El número de cuenta solo admite dígitos y guiones.',
        'INVALID_BANK_ACCOUNT',
      );
    }

    return {
      firstName,
      lastName,
      documentType: data.documentType,
      documentNumber,
      birthDate,
      gender: data.gender,
      phone: optionalText(data.phone, 20, 'celular'),
      email: data.email?.trim() ? Email.create(data.email) : null,
      address: optionalText(data.address, 500, 'dirección'),
      employeeType: data.employeeType,
      position: optionalText(data.position, 100, 'cargo'),
      department: optionalText(data.department, 100, 'departamento'),
      hireDate,
      contractType: data.contractType,
      baseSalary,
      integralSalary: (data.integralSalary ?? false) && data.contractType !== 'prestacion',
      recurringDeductions: {
        libranza: nonNegative(data.fixedLibranza, 'libranza'),
        sindicato: nonNegative(data.fixedSindicato, 'cuota sindical'),
        embargo: nonNegative(data.fixedEmbargo, 'embargo'),
        embargoIsAlimony: data.embargoIsAlimony ?? false,
      },
      bankName: optionalText(data.bankName, 100, 'banco'),
      bankAccount,
      accountType,
      eps: optionalText(data.eps, 100, 'EPS'),
      pensionFund: optionalText(data.pensionFund, 100, 'fondo de pensión'),
      arl: optionalText(data.arl, 100, 'ARL'),
      arlRiskClass,
      withholding: {
        hasDependents: data.withholdingDependents ?? false,
        prepaidHealth: nonNegative(data.withholdingPrepaidHealth, 'medicina prepagada'),
        housingInterest: nonNegative(data.withholdingHousingInterest, 'intereses de vivienda'),
        voluntaryPension: nonNegative(data.voluntaryPension, 'aportes voluntarios'),
      },
    };
  }
}

function requiredText(value: string, max: number, field: string): string {
  const trimmed = value?.trim();
  Guard.againstEmpty(trimmed, field);
  Guard.againstMaxLength(trimmed, max, field);
  return trimmed;
}

function optionalText(value: string | null | undefined, max: number, field: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  Guard.againstMaxLength(trimmed, max, field);
  return trimmed;
}

function nonNegative(value: number | undefined, field: string): Money {
  const amount = Money.of(value ?? 0);
  Guard.againstNegative(amount.amount, field);
  return amount;
}
