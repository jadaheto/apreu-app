/**
 * Payloads of the integration events accounting subscribes to
 * (`docs/eventos-integracion.md`). Declared locally so this context does not
 * import other modules. Amounts in pesos, dates as ISO strings.
 */
export const ACCOUNTING_SUBSCRIPTIONS = {
  paymentRegistered: 'finance.payment-registered',
  paymentVoided: 'finance.payment-voided',
  expenseRegistered: 'finance.expense-registered',
  payrollPeriodPaid: 'hr.payroll-period-paid',
} as const;

export interface PaymentRegisteredPayload {
  paymentId: number;
  receiptNumber: string;
  studentId: number;
  totalAmount: number;
  method: string;
  paidAt: string;
  appliedCharges: {
    studentChargeId: number;
    conceptId: number;
    conceptName: string;
    /** `billing_concepts.category` (matricula, pension, transporte…); absent in older events. */
    conceptCategory?: string | null;
    amount: number;
  }[];
}

export interface PaymentVoidedPayload {
  paymentId: number;
  receiptNumber: string;
  reason: string;
}

export interface ExpenseRegisteredPayload {
  expenseId: number;
  categoryId: number | null;
  description: string;
  amount: number;
  date: string;
  source: string;
}

export interface PayrollPeriodPaidPayload {
  periodId: number;
  periodName: string;
  startDate: string;
  endDate: string;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
}

/** Integration events published by accounting. */
export const ACCOUNTING_EVENTS = {
  automaticEntrySkipped: 'accounting.automatic-entry-skipped',
} as const;

/**
 * An automatic entry was not generated (missing parametrization, no open
 * period, account rule violated…). Reported so the school can fix it; the
 * fact of the other context is not affected.
 */
export type AutomaticEntrySkippedPayload = {
  /** e.g. `finance.payment`, `finance.expense`, `hr.payroll-period`. */
  sourceType: string;
  sourceId: string;
  /** Stable code, e.g. `MISSING_POSTING_RULE`, `NO_OPEN_PERIOD`. */
  reason: string;
  message: string;
  /** Rule-key fallback chains with no configured account (only for `MISSING_POSTING_RULE`). */
  missingKeys: string[][];
};
