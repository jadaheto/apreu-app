import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import {
  ARL_RISK_CLASSES,
  BANK_ACCOUNT_TYPES,
  CONTRACT_TYPES,
  DOCUMENT_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYEE_TYPES,
  GENDERS,
} from '../../domain/employees/employee-catalogs.js';
import { Employee } from '../../domain/employees/employee.js';
import { EmployeeOrmEntity } from './employee.orm-entity.js';
import { enumValue } from './enum-value.js';

/** Translates between `employees` rows and the {@link Employee} aggregate. */
export const EmployeeMapper = {
  toDomain(row: EmployeeOrmEntity): Employee {
    return Employee.restore(row.id, {
      userId: row.userId,
      code: row.code,
      firstName: row.firstName,
      lastName: row.lastName,
      documentType: enumValue(row.documentType, DOCUMENT_TYPES, 'cc'),
      documentNumber: row.documentNumber,
      birthDate: row.birthDate,
      gender: enumValue(row.gender, GENDERS, 'O'),
      phone: row.phone,
      email: safeEmail(row.email),
      address: row.address,
      employeeType: enumValue(row.employeeType, EMPLOYEE_TYPES, 'otro'),
      position: row.position,
      department: row.department,
      status: enumValue(row.status, EMPLOYEE_STATUSES, 'active'),
      hireDate: row.hireDate,
      contractType: enumValue(row.contractType, CONTRACT_TYPES, 'indefinido'),
      baseSalary: Money.of(row.baseSalary),
      integralSalary: row.integralSalary,
      recurringDeductions: {
        libranza: Money.of(row.fixedLibranza),
        sindicato: Money.of(row.fixedSindicato),
        embargo: Money.of(row.fixedEmbargo),
        embargoIsAlimony: row.embargoAlimony,
      },
      bankName: row.bankName,
      bankAccount: row.bankAccount,
      accountType: enumValue(row.accountType, BANK_ACCOUNT_TYPES, 'ahorros'),
      eps: row.eps,
      pensionFund: row.pensionFund,
      arl: row.arl,
      arlRiskClass: enumValue(Number(row.arlRiskClass), ARL_RISK_CLASSES, 1),
      withholding: {
        hasDependents: row.withholdingDependents,
        prepaidHealth: Money.of(row.withholdingPrepaidHealth),
        housingInterest: Money.of(row.withholdingHousingInterest),
        voluntaryPension: Money.of(row.voluntaryPension),
      },
      retirementDate: row.retirementDate,
      retirementReason: row.retirementReason,
      createdAt: row.createdAt,
    });
  },

  toPersistence(e: Employee): EmployeeOrmEntity {
    const row = new EmployeeOrmEntity();
    if (e.id !== null) row.id = e.id;
    const deductions = e.recurringDeductions;
    const withholding = e.withholding;
    Object.assign(row, {
      userId: e.userId,
      code: e.code,
      firstName: e.firstName,
      lastName: e.lastName,
      documentType: e.documentType,
      documentNumber: e.documentNumber,
      birthDate: e.birthDate,
      gender: e.gender,
      phone: e.phone,
      email: e.email?.toString() ?? null,
      address: e.address,
      employeeType: e.employeeType,
      position: e.position,
      department: e.department,
      status: e.status,
      hireDate: e.hireDate,
      retirementDate: e.retirementDate,
      retirementReason: e.retirementReason,
      contractType: e.contractType,
      baseSalary: e.baseSalary.amount,
      integralSalary: e.integralSalary,
      fixedLibranza: deductions.libranza.amount,
      fixedSindicato: deductions.sindicato.amount,
      fixedEmbargo: deductions.embargo.amount,
      embargoAlimony: deductions.embargoIsAlimony,
      bankName: e.bankName,
      bankAccount: e.bankAccount,
      accountType: e.accountType,
      eps: e.eps,
      pensionFund: e.pensionFund,
      arl: e.arl,
      arlRiskClass: e.arlRiskClass,
      withholdingDependents: withholding.hasDependents,
      withholdingPrepaidHealth: withholding.prepaidHealth.amount,
      withholdingHousingInterest: withholding.housingInterest.amount,
      voluntaryPension: withholding.voluntaryPension.amount,
    });
    return row;
  },
};

/** Legacy rows may contain malformed e-mails; they are read as "no e-mail". */
function safeEmail(raw: string | null): Email | null {
  if (!raw?.trim()) return null;
  try {
    return Email.create(raw);
  } catch {
    return null;
  }
}
