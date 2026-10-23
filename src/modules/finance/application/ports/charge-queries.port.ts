import type { Paginated, PageRequest } from '../../../../shared/domain/pagination.js';
import type { BillingPeriod } from '../../domain/billing-period.vo.js';
import type { ChargeStatus } from '../../domain/student-charge.js';

export interface ChargeSearchCriteria {
  studentId?: number;
  conceptId?: number;
  status?: ChargeStatus;
  /** `YYYY-MM` billed month. */
  period?: string;
  /** Only open charges past their due date. */
  overdueOnly?: boolean;
  /** Student name, code or document. */
  search?: string;
  /** Local day used to derive "overdue". */
  today: string;
}

/** Row of the charges list (read model). */
export interface ChargeListItem {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  conceptId: number;
  conceptName: string;
  conceptCategory: string;
  description: string;
  period: string;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  status: ChargeStatus;
  isOverdue: boolean;
}

/** Generated charges grouped by concept and billed month (legacy "Cargos generados"). */
export interface ChargeSummaryRow {
  conceptId: number;
  conceptName: string;
  period: string;
  chargesCount: number;
  totalNet: number;
  totalPaid: number;
  paidCount: number;
}

/** Open charge with balance, used for the collection bank file. */
export interface CollectibleCharge {
  chargeId: number;
  studentId: number;
  documentNumber: string | null;
  pendingAmount: number;
}

/** Reporting queries over `student_charges`. Paid amounts only count applied payments. */
export interface ChargeQueriesPort {
  search(criteria: ChargeSearchCriteria, page: PageRequest): Promise<Paginated<ChargeListItem>>;
  summary(limit: number): Promise<ChargeSummaryRow[]>;
  collectibleForPeriod(period: BillingPeriod): Promise<CollectibleCharge[]>;
}

export const CHARGE_QUERIES = Symbol('ChargeQueriesPort');
