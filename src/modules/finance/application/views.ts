import type { BillingConcept } from '../domain/billing-concept.js';
import type { ConceptCategory } from '../domain/concept-category.js';
import type { Expense } from '../domain/expense.js';
import type { ExpenseCategory } from '../domain/expense-category.js';
import type { ChargeStatus, StudentCharge } from '../domain/student-charge.js';
import type { BillingStudent } from '../domain/student-directory.port.js';

/** Read model of a billing concept. */
export interface BillingConceptView {
  id: number;
  name: string;
  description: string | null;
  code: string | null;
  category: ConceptCategory;
  amount: number;
  taxRate: number;
  isActive: boolean;
}

export const toBillingConceptView = (concept: BillingConcept): BillingConceptView => ({
  id: concept.id as number,
  name: concept.name,
  description: concept.description,
  code: concept.code,
  category: concept.category,
  amount: concept.amount.amount,
  taxRate: concept.taxRate.percent,
  isActive: concept.isActive,
});

/** Read model of a student charge with its derived balances. */
export interface ChargeView {
  id: number;
  studentId: number;
  conceptId: number;
  description: string;
  period: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: ChargeStatus;
  isOverdue: boolean;
  academicYear: number;
  createdAt: Date | null;
}

export const toChargeView = (charge: StudentCharge, today: string): ChargeView => ({
  id: charge.id as number,
  studentId: charge.studentId,
  conceptId: charge.conceptId,
  description: charge.description,
  period: charge.period.toString(),
  amount: charge.amounts.base.amount,
  taxRate: charge.amounts.taxRate.percent,
  taxAmount: charge.amounts.tax.amount,
  discountAmount: charge.amounts.discount.amount,
  netAmount: charge.amounts.net.amount,
  paidAmount: charge.paidAmount.amount,
  pendingAmount: charge.isCancelled ? 0 : charge.pendingAmount.amount,
  dueDate: charge.dueDate,
  status: charge.status,
  isOverdue: charge.isOverdue(today),
  academicYear: charge.academicYear,
  createdAt: charge.createdAt,
});

/** Totals over the non-cancelled charges of a student (bugs B26/B27 fixed). */
export interface ChargesSummary {
  totalCharged: number;
  totalPaid: number;
  balance: number;
  overdueBalance: number;
  pendingCount: number;
  paidCount: number;
}

export const summarizeCharges = (charges: StudentCharge[], today: string): ChargesSummary => {
  const live = charges.filter((charge) => !charge.isCancelled);
  const sum = (items: StudentCharge[], pick: (charge: StudentCharge) => number) =>
    Math.round(items.reduce((total, charge) => total + pick(charge) * 100, 0)) / 100;
  return {
    totalCharged: sum(live, (charge) => charge.amounts.net.amount),
    totalPaid: sum(live, (charge) => charge.paidAmount.amount),
    balance: sum(live, (charge) => charge.pendingAmount.amount),
    overdueBalance: sum(
      live.filter((charge) => charge.isOverdue(today)),
      (charge) => charge.pendingAmount.amount,
    ),
    pendingCount: live.filter((charge) => charge.isOpen).length,
    paidCount: live.filter((charge) => charge.status === 'paid').length,
  };
};

/** Student data shown in finance screens. */
export type StudentSummaryView = BillingStudent;

/** Read model of an expense. */
export interface ExpenseView {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  description: string;
  amount: number;
  date: string;
  vendor: string | null;
  receiptNo: string | null;
  paymentMethod: string;
  notes: string | null;
  createdAt: Date | null;
}

export const toExpenseView = (expense: Expense, categoryName: string | null): ExpenseView => ({
  id: expense.id as number,
  categoryId: expense.categoryId,
  categoryName,
  description: expense.description,
  amount: expense.amount.amount,
  date: expense.date,
  vendor: expense.vendor,
  receiptNo: expense.receiptNo,
  paymentMethod: expense.paymentMethod,
  notes: expense.notes,
  createdAt: expense.createdAt,
});

/** Read model of an expense category. */
export interface ExpenseCategoryView {
  id: number;
  name: string;
}

export const toExpenseCategoryView = (category: ExpenseCategory): ExpenseCategoryView => ({
  id: category.id as number,
  name: category.name,
});
