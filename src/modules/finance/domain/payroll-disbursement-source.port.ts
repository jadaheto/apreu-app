/** Payroll period summary (HR context, `payroll_periods`). */
export interface PayrollPeriodInfo {
  id: number;
  name: string;
  status: string;
}

/** Net pay of one employee with bank data (`payroll_payments` + `employees`). */
export interface DisbursementLine {
  documentNumber: string;
  fullName: string;
  bankAccount: string | null;
  accountType: string | null;
  netSalary: number;
}

/** Read-only access to closed payroll, used to build the disbursement flat file. */
export interface PayrollDisbursementSourcePort {
  findPeriod(id: number): Promise<PayrollPeriodInfo | null>;
  /** Lines with net salary > 0. */
  linesOf(periodId: number): Promise<DisbursementLine[]>;
}

export const PAYROLL_DISBURSEMENT_SOURCE = Symbol('PayrollDisbursementSourcePort');
