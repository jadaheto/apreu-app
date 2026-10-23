/** Totals of a student's account (analysis 03 rule 24). */
export interface FinancialSummary {
  /** Σ net amount of non-cancelled charges. */
  charged: number;
  /** Σ amounts applied to those charges. */
  paid: number;
  /** charged − paid (never `NULL`: fixes bug B6). */
  balance: number;
  /** Charges `pending`/`overdue`/`partial` whose due date has passed. */
  overdueCount: number;
}

/** A charge not yet fully paid (cancelled charges excluded: bug B7). */
export interface PendingCharge {
  chargeId: number;
  concept: string;
  category: string | null;
  description: string;
  dueDate: string;
  netAmount: number;
  applied: number;
  pending: number;
  status: string;
  isOverdue: boolean;
}

/** A payment received from the student. */
export interface PaymentRecord {
  paymentId: number;
  receiptNumber: string | null;
  amount: number;
  method: string;
  paidAt: Date;
  status: string;
  reference: string | null;
  notes: string | null;
  /** Names of the concepts the payment was applied to. */
  concepts: string[];
}

/** Read-only port over the finance context (`student_charges`, `payments`, `payment_applications`). */
export interface StudentFinancePort {
  summary(studentId: number, today: string): Promise<FinancialSummary>;
  pendingCharges(studentId: number, today: string): Promise<PendingCharge[]>;
  /** Applied and pending payments (reversed ones excluded), most recent first. */
  payments(studentId: number, limit: number): Promise<PaymentRecord[]>;
}

export const STUDENT_FINANCE = Symbol('StudentFinancePort');
