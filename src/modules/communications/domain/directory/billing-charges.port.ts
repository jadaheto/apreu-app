/** A pending charge to be notified, with the contact data of the primary guardian. */
export interface ChargeNotice {
  chargeId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  conceptName: string | null;
  netAmount: number;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianMobile: string | null;
}

export interface PendingChargesFilter {
  /** Inclusive `YYYY-MM-DD` range over `due_date`. */
  from: string;
  to: string;
  conceptId?: number;
}

/** Read-only access to `student_charges` (finance context) for billing notices (RN-COM-07). */
export interface BillingChargesPort {
  /** `status = 'pending'` charges due in the range, ordered by student last name. */
  pendingCharges(filter: PendingChargesFilter): Promise<ChargeNotice[]>;
}

export const BILLING_CHARGES = Symbol('BillingChargesPort');
