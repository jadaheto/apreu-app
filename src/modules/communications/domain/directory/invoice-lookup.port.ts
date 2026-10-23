/** Electronic invoice data needed to e-mail it to the buyer. */
export interface ElectronicInvoiceData {
  id: number;
  number: string;
  cufe: string | null;
  customerName: string;
  customerEmail: string | null;
  total: number;
  /** `YYYY-MM-DD`. */
  issueDate: string;
  /** Signed UBL XML, when available. */
  xmlContent: string | null;
}

/** Read-only access to `dian_invoices` (e-invoicing context). */
export interface InvoiceLookupPort {
  findById(dianInvoiceId: number): Promise<ElectronicInvoiceData | null>;
}

export const INVOICE_LOOKUP = Symbol('InvoiceLookupPort');
