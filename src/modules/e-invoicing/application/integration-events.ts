import type { DocumentType } from '../domain/catalogs.js';

/** Integration events published or consumed by the e-invoicing context (`docs/eventos-integracion.md`). */
export const E_INVOICING_EVENTS = {
  invoiceAccepted: 'e-invoicing.invoice-accepted',
  invoiceRejected: 'e-invoicing.invoice-rejected',
} as const;

/** Published by communications once the invoice e-mail reached the buyer. */
export const COMMUNICATIONS_EVENTS = {
  invoiceEmailSent: 'communications.invoice-email-sent',
} as const;

/** `communications.invoice-email-sent`. */
export interface InvoiceEmailSentPayload {
  dianInvoiceId: number;
  number: string;
  to: string;
  sentAt: string;
}

export const FINANCE_EVENTS = {
  paymentRegistered: 'finance.payment-registered',
  paymentVoided: 'finance.payment-voided',
} as const;

/**
 * `e-invoicing.invoice-accepted`. Contract fields plus `documentType`
 * (`fv`, `nc`, `nd`) so consumers can tell invoices from notes.
 */
export interface InvoiceAcceptedPayload {
  dianInvoiceId: number;
  number: string;
  cufe: string;
  paymentId: number | null;
  total: number;
  documentType: DocumentType;
}

/** `e-invoicing.invoice-rejected` (contract fields plus `documentType`). */
export interface InvoiceRejectedPayload {
  dianInvoiceId: number;
  number: string;
  errors: string[];
  documentType: DocumentType;
}

/** `finance.payment-registered` (published by finance). */
export interface PaymentRegisteredPayload {
  paymentId: number;
  receiptNumber: string;
  studentId: number;
  totalAmount: number;
  method: string;
  paidAt: string;
  appliedCharges: { studentChargeId: number; conceptId: number; conceptName: string; amount: number }[];
}

/** `finance.payment-voided` (published by finance). */
export interface PaymentVoidedPayload {
  paymentId: number;
  receiptNumber: string;
  reason: string;
}
