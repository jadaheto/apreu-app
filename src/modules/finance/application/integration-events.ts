import type { PaymentMethod } from '../domain/payment-method.js';

/** Published after a payment is registered at the cashier. */
export const PAYMENT_REGISTERED = 'finance.payment-registered';
export interface PaymentRegisteredPayload {
  paymentId: number;
  receiptNumber: string;
  studentId: number;
  totalAmount: number;
  method: PaymentMethod;
  paidAt: string;
  appliedCharges: {
    studentChargeId: number;
    conceptId: number;
    conceptName: string;
    /** Additional field: lets subscribers detect certificate concepts without name matching. */
    conceptCategory: string;
    amount: number;
  }[];
}

/** Published after a payment is voided. */
export const PAYMENT_VOIDED = 'finance.payment-voided';
export interface PaymentVoidedPayload {
  paymentId: number;
  receiptNumber: string;
  reason: string;
}

/** Published after an expense is registered (manually or from payroll). */
export const EXPENSE_REGISTERED = 'finance.expense-registered';
export type ExpenseSource = 'manual' | 'payroll';
export interface ExpenseRegisteredPayload {
  expenseId: number;
  categoryId: number | null;
  description: string;
  amount: number;
  date: string;
  source: ExpenseSource;
}

/** Additional event: a credit balance (unapplied payment money) was applied to charges. */
export const CREDIT_APPLIED = 'finance.credit-applied';
export interface CreditAppliedPayload {
  studentId: number;
  applications: {
    paymentId: number;
    receiptNumber: string;
    studentChargeId: number;
    conceptId: number;
    amount: number;
  }[];
}

/** Subscribed: HR paid a payroll period. */
export const PAYROLL_PERIOD_PAID = 'hr.payroll-period-paid';
export interface PayrollPeriodPaidPayload {
  periodId: number;
  periodName: string;
  startDate: string;
  endDate: string;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
}
