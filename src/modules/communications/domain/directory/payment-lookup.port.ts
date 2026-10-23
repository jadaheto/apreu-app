/** Data needed to confirm a payment by WhatsApp (RN-COM-09). */
export interface PaymentConfirmationData {
  paymentId: number;
  receiptNumber: string | null;
  amount: number;
  studentId: number;
  studentName: string;
  guardianName: string | null;
  guardianMobile: string | null;
}

/** Read-only access to `payments` (finance context). */
export interface PaymentLookupPort {
  findForConfirmation(paymentId: number): Promise<PaymentConfirmationData | null>;
}

export const PAYMENT_LOOKUP = Symbol('PaymentLookupPort');
