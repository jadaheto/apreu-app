import type {
  ArlRiskClass,
  BankAccountType,
  ContractType,
  DocumentType,
  EmployeeStatus,
  EmployeeType,
  Gender,
} from '../../domain/employees/employee-catalogs.js';
import type { Employee } from '../../domain/employees/employee.js';

/** Row of the employee directory. */
export interface EmployeeSummaryView {
  id: number;
  code: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeType: EmployeeType;
  position: string | null;
  department: string | null;
  contractType: ContractType;
  hireDate: string | null;
  baseSalary: number;
  status: EmployeeStatus;
  hasUserAccount: boolean;
}

/** Full employee record (HR detail and the employee's own profile). */
export interface EmployeeView extends EmployeeSummaryView {
  userId: number | null;
  firstName: string;
  lastName: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string | null;
  gender: Gender;
  address: string | null;
  integralSalary: boolean;
  recurringDeductions: { libranza: number; sindicato: number; embargo: number; embargoIsAlimony: boolean };
  bankAccount: { bankName: string | null; number: string | null; type: BankAccountType };
  socialSecurity: { eps: string | null; pensionFund: string | null; arl: string | null; arlRiskClass: ArlRiskClass };
  withholding: { hasDependents: boolean; prepaidHealth: number; housingInterest: number; voluntaryPension: number };
  retirementDate: string | null;
  retirementReason: string | null;
  createdAt: Date | null;
}

export const toEmployeeSummaryView = (e: Employee): EmployeeSummaryView => ({
  id: e.id as number,
  code: e.code,
  fullName: e.fullName,
  email: e.email?.toString() ?? null,
  phone: e.phone,
  employeeType: e.employeeType,
  position: e.position,
  department: e.department,
  contractType: e.contractType,
  hireDate: e.hireDate,
  baseSalary: e.baseSalary.amount,
  status: e.status,
  hasUserAccount: e.userId !== null,
});

export const toEmployeeView = (e: Employee): EmployeeView => {
  const deductions = e.recurringDeductions;
  const withholding = e.withholding;
  return {
    ...toEmployeeSummaryView(e),
    userId: e.userId,
    firstName: e.firstName,
    lastName: e.lastName,
    documentType: e.documentType,
    documentNumber: e.documentNumber,
    birthDate: e.birthDate,
    gender: e.gender,
    address: e.address,
    integralSalary: e.integralSalary,
    recurringDeductions: {
      libranza: deductions.libranza.amount,
      sindicato: deductions.sindicato.amount,
      embargo: deductions.embargo.amount,
      embargoIsAlimony: deductions.embargoIsAlimony,
    },
    bankAccount: { bankName: e.bankName, number: e.bankAccount, type: e.accountType },
    socialSecurity: { eps: e.eps, pensionFund: e.pensionFund, arl: e.arl, arlRiskClass: e.arlRiskClass },
    withholding: {
      hasDependents: withholding.hasDependents,
      prepaidHealth: withholding.prepaidHealth.amount,
      housingInterest: withholding.housingInterest.amount,
      voluntaryPension: withholding.voluntaryPension.amount,
    },
    retirementDate: e.retirementDate,
    retirementReason: e.retirementReason,
    createdAt: e.createdAt,
  };
};
