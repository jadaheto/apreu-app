import { Role } from '../../../../shared/domain/role.js';

/** `employees.employee_type`. */
export const EMPLOYEE_TYPES = ['docente', 'administrativo', 'directivo', 'servicios', 'otro'] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];

/** `employees.status`. */
export const EMPLOYEE_STATUSES = ['active', 'inactive', 'suspended', 'retired', 'on_leave'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** `employees.contract_type`; `prestacion` = contrato de prestación de servicios (contratista, no nómina). */
export const CONTRACT_TYPES = ['indefinido', 'fijo', 'obra', 'prestacion'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const DOCUMENT_TYPES = ['cc', 'pa', 'ext'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const GENDERS = ['M', 'F', 'O'] as const;
export type Gender = (typeof GENDERS)[number];

export const BANK_ACCOUNT_TYPES = ['ahorros', 'corriente'] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

/** ARL risk classes I–V (Decreto 1295/1994, Decreto 1772/1994). */
export const ARL_RISK_CLASSES = [1, 2, 3, 4, 5] as const;
export type ArlRiskClass = (typeof ARL_RISK_CLASSES)[number];

/** Statuses that keep access to the employee portal (legacy `login.php`). */
export const STATUSES_WITH_ACCESS: readonly EmployeeStatus[] = ['active', 'on_leave'];

/**
 * Allowed status transitions (analysis 07 §4.5, proposed machine). Retirement
 * is a separate operation (`Employee.retire`) because it needs a date and reason.
 */
export const STATUS_TRANSITIONS: Readonly<Record<EmployeeStatus, readonly EmployeeStatus[]>> = {
  active: ['on_leave', 'suspended', 'inactive'],
  on_leave: ['active'],
  suspended: ['active'],
  inactive: ['active'],
  retired: [],
};

export const CONTRACT_LABELS: Readonly<Record<ContractType, string>> = {
  indefinido: 'término indefinido',
  fijo: 'término fijo',
  obra: 'obra o labor',
  prestacion: 'prestación de servicios',
};

export const DOCUMENT_LABELS: Readonly<Record<DocumentType, string>> = {
  cc: 'cédula de ciudadanía',
  pa: 'pasaporte',
  ext: 'cédula de extranjería',
};

/**
 * Role of the user account created for a new employee.
 *
 * Fixes legacy S-3 (`hr/employees.php:89-101`), where an `administrativo`
 * employee received the `admin` role: HR can only grant portal roles. Any
 * back-office role must be granted explicitly by an administrator in identity.
 */
export const roleForEmployeeType = (type: EmployeeType): Role => (type === 'docente' ? Role.TEACHER : Role.EMPLOYEE);
