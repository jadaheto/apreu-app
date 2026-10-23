/**
 * Integration events published or consumed by the students context
 * (contract: `docs/eventos-integracion.md`).
 */

/** Published after an enrollment commits. */
export const STUDENT_ENROLLED = 'students.student-enrolled';
export interface StudentEnrolledPayload {
  studentId: number;
  code: string;
  fullName: string;
  gradeId: number | null;
  classroomId: number | null;
  documentNumber: string;
  guardianEmail: string | null;
}

/** Published when the status of a student changes (withdrawal, graduation…). Additional event. */
export const STUDENT_STATUS_CHANGED = 'students.student-status-changed';
export interface StudentStatusChangedPayload {
  studentId: number;
  code: string;
  previousStatus: string;
  status: string;
  reason: string | null;
}

/** Published when a certificate becomes valid (issued or approved). Additional event. */
export const CERTIFICATE_ISSUED = 'students.certificate-issued';
export interface CertificateIssuedPayload {
  certificateId: number;
  studentId: number;
  type: string;
  paymentId: number | null;
  verificationCode: string;
}

/** Consumed: a payment was registered by the cashier (finance context). */
export const PAYMENT_REGISTERED = 'finance.payment-registered';
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
    amount: number;
  }[];
}
