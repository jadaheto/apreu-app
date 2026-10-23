import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { BillingPeriod } from '../../domain/billing-period.vo.js';
import type { PaymentMethod } from '../../domain/payment-method.js';
import type { PaymentStatus } from '../../domain/payment.js';

export interface PaymentSearchCriteria {
  /** Inclusive `YYYY-MM-DD` bounds over the payment date (bug B51 excluded the last day). */
  from?: string;
  to?: string;
  studentId?: number;
  status?: PaymentStatus;
  method?: PaymentMethod;
  /** Receipt number, student name or code. */
  search?: string;
}

/** Row of the payments list (read model). */
export interface PaymentListItem {
  id: number;
  receiptNumber: string;
  studentId: number;
  studentName: string;
  studentCode: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  method: PaymentMethod;
  paidAt: Date;
  status: PaymentStatus;
  reference: string | null;
  bankRef: string | null;
  reconciled: boolean;
  reconciledAt: Date | null;
  cashierName: string | null;
  /** Every concept paid (legacy showed one arbitrary concept, bug B45). */
  concepts: string[];
}

/** Line of the printable receipt. */
export interface ReceiptLine {
  chargeId: number;
  conceptName: string;
  description: string;
  amount: number;
  /** Balance of the charge right now. */
  chargePending: number;
}

/** Data of the printable cash receipt (legacy `finance/print_receipt.php`). */
export interface ReceiptData {
  paymentId: number;
  receiptNumber: string;
  studentId: number;
  studentName: string;
  studentCode: string;
  documentNumber: string | null;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  cashierName: string | null;
  voidReason: string | null;
  lines: ReceiptLine[];
}

/** Reporting queries over `payments`. */
export interface PaymentQueriesPort {
  search(criteria: PaymentSearchCriteria, page: PageRequest): Promise<Paginated<PaymentListItem>>;
  /** Most recent first. */
  listByStudent(studentId: number, limit: number): Promise<PaymentListItem[]>;
  findReceipt(receiptNumber: string): Promise<ReceiptData | null>;
  /** Applied payments dated in the month (rule RN-23). */
  forReconciliation(period: BillingPeriod): Promise<PaymentListItem[]>;
}

export const PAYMENT_QUERIES = Symbol('PaymentQueriesPort');
