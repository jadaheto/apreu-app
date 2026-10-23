import { Amounts } from '../domain/amounts.js';
import type { DocumentType, TaxTreatment } from '../domain/catalogs.js';
import type { DianOperation } from '../domain/dian-response.js';
import type {
  BillingReference,
  Discrepancy,
  DocumentStatus,
  ElectronicDocument,
  PaymentMeans,
} from '../domain/electronic-document.js';

/** Row of the documents list. */
export interface DocumentSummaryView {
  id: number;
  type: DocumentType;
  number: string;
  issueDate: string;
  issueTime: string;
  customerName: string;
  customerIdType: string;
  customerIdNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  status: DocumentStatus;
  statusMessage: string | null;
  cufe: string | null;
  trackId: string | null;
  sourcePaymentId: number | null;
  attempts: number;
  createdAt: Date | null;
}

export interface DocumentLineView {
  description: string;
  code: string;
  quantity: number;
  unitPrice: number;
  taxTreatment: TaxTreatment;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
}

export interface SubmissionView {
  operation: DianOperation;
  outcome: string;
  statusCode: string | null;
  statusMessage: string | null;
  errors: string[];
  trackId: string | null;
  at: Date;
}

/** Full document with lines, DIAN answer and submission history. */
export interface DocumentDetailView extends DocumentSummaryView {
  environment: string;
  customer: {
    name: string;
    idType: string;
    idNumber: string;
    dv: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    cityCode: string;
    cityName: string;
    departmentCode: string;
    departmentName: string;
  };
  lines: DocumentLineView[];
  paymentMeans: PaymentMeans;
  notes: string | null;
  billingReference: BillingReference | null;
  discrepancy: Discrepancy | null;
  qrUrl: string | null;
  fileName: string | null;
  statusCode: string | null;
  errors: string[];
  notices: string[];
  operation: DianOperation | null;
  hasApplicationResponse: boolean;
  hasAttachedDocument: boolean;
  submissions: SubmissionView[];
}

export const toDocumentSummaryView = (document: ElectronicDocument): DocumentSummaryView => {
  const totals = document.totals;
  return {
    id: document.id as number,
    type: document.type,
    number: document.number,
    issueDate: document.issueDate,
    issueTime: document.issueTime,
    customerName: document.customer.name,
    customerIdType: document.customer.idType,
    customerIdNumber: document.customer.idNumber,
    subtotal: Amounts.toNumber(totals.lineExtensionCents),
    tax: Amounts.toNumber(totals.taxCents),
    total: Amounts.toNumber(totals.payableCents),
    status: document.status,
    statusMessage: document.statusMessage,
    cufe: document.uniqueCode,
    trackId: document.trackId,
    sourcePaymentId: document.sourcePaymentId,
    attempts: document.attempts,
    createdAt: document.createdAt,
  };
};

export const toDocumentDetailView = (document: ElectronicDocument): DocumentDetailView => {
  const customer = document.customer;
  return {
    ...toDocumentSummaryView(document),
    environment: document.environment,
    customer: {
      name: customer.name,
      idType: customer.idType,
      idNumber: customer.idNumber,
      dv: customer.dv,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      ...customer.location,
    },
    lines: document.lines.map((line) => ({
      description: line.description,
      code: line.code,
      quantity: line.quantityHundredths / 100,
      unitPrice: Amounts.toNumber(line.unitPriceCents),
      taxTreatment: line.taxTreatment,
      taxRate: line.taxRateBasisPoints / 100,
      lineTotal: Amounts.toNumber(line.lineTotalCents),
      taxAmount: Amounts.toNumber(line.taxCents),
    })),
    paymentMeans: { ...document.paymentMeans },
    notes: document.notes,
    billingReference: document.billingReference,
    discrepancy: document.discrepancy,
    qrUrl: document.qrUrl,
    fileName: document.fileNames ? `${document.fileNames.xml}.xml` : null,
    statusCode: document.statusCode,
    errors: [...document.errors],
    notices: [...document.notices],
    operation: document.operation,
    hasApplicationResponse: Boolean(document.applicationResponse),
    hasAttachedDocument: Boolean(document.attachedDocument),
    submissions: document.submissions.map(({ id: _id, ...submission }) => ({
      ...submission,
      errors: [...submission.errors],
    })),
  };
};
