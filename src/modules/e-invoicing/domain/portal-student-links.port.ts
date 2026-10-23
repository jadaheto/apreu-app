/** Student or guardian signed in to the portal. */
export interface PortalUser {
  userId: number;
  email: string;
  role: string;
}

/**
 * Read-only view of the students/finance tables needed by the portal:
 * which students a portal user may see and which finance payments belong to a
 * student (an electronic document belongs to the student of the payment it was
 * generated from, `dian_invoices.source_payment_id → payments.student_id`).
 */
export interface PortalStudentLinksPort {
  /** Same rule as the finance and students portals: `user_id` link, e-mail only as fallback for unlinked records. */
  studentIdsLinkedTo(user: PortalUser): Promise<number[]>;
  /** Ids of every payment (any status) registered for the student. */
  paymentIdsOfStudent(studentId: number): Promise<number[]>;
}

export const PORTAL_STUDENT_LINKS = Symbol('PortalStudentLinksPort');
