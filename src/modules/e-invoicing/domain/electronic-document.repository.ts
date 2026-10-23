import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { DocumentType } from './catalogs.js';
import type { DocumentStatus, ElectronicDocument } from './electronic-document.js';

export interface DocumentSearchCriteria {
  type?: DocumentType;
  status?: DocumentStatus;
  /** Issue date range (`YYYY-MM-DD`, inclusive). */
  from?: string;
  to?: string;
  /** Number, customer name or identification. */
  search?: string;
  /** Only documents generated from one of these finance payments (an empty list matches nothing). */
  sourcePaymentIds?: readonly number[];
  /** Statuses left out of the result. */
  excludeStatuses?: readonly DocumentStatus[];
}

/** Count of documents per type and status. */
export type DocumentCounts = Record<DocumentType, Partial<Record<DocumentStatus, number>>>;

export interface DocumentStats {
  counts: DocumentCounts;
  /** Σ payable amount (cents) of accepted invoices in the range. */
  acceptedInvoicesTotalCents: number;
}

/** Output port for {@link ElectronicDocument} aggregates (`dian_invoices` + submissions log). */
export interface ElectronicDocumentRepository {
  /** Loads the document with its submissions history. */
  findById(id: number): Promise<ElectronicDocument | null>;
  /** Documents of a type generated from a finance payment (idempotency of the automatic invoicing). */
  findBySourcePayment(paymentId: number, type: DocumentType): Promise<ElectronicDocument[]>;
  search(criteria: DocumentSearchCriteria, page: PageRequest): Promise<Paginated<ElectronicDocument>>;
  stats(criteria: Pick<DocumentSearchCriteria, 'from' | 'to'>): Promise<DocumentStats>;
  /** Documents waiting to be (re)sent: `signed` or `send_error`, oldest first. */
  findPendingSubmission(limit: number): Promise<ElectronicDocument[]>;
  /** Σ payable (cents) of the non-rejected credit notes that reference the invoice. */
  creditedTotalCents(invoiceId: number): Promise<number>;
  /** Counts of the documents sent to the habilitation test set (`SendTestSetAsync`). */
  testSetCounts(): Promise<DocumentCounts>;
  /** Records that the document was e-mailed to the buyer (`email_sent`, `email_sent_at`). */
  markEmailSent(id: number, sentAt: Date): Promise<void>;
  /** Inserts or updates; assigns the id of new documents and persists new submissions. */
  save(document: ElectronicDocument): Promise<void>;
}

export const ELECTRONIC_DOCUMENT_REPOSITORY = Symbol('ElectronicDocumentRepository');
