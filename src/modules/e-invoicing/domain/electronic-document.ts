import { BusinessRuleViolationError, ConflictError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import type { BogotaDateTime } from './bogota-time.js';
import {
  CREDIT_NOTE_CONCEPTS,
  DEBIT_NOTE_CONCEPTS,
  type DianEnvironment,
  type DocumentType,
  isCatalogCode,
  PAYMENT_MEANS,
  type PaymentForm,
} from './catalogs.js';
import type { DianOperation, DianResponse, InterpretedResponse } from './dian-response.js';
import { computeTotals, type DocumentLine, type DocumentTotals } from './document-line.js';
import type { DianFileNames } from './file-naming.js';
import type { ReservedNumber } from './numbering-resolution.js';
import type { Party } from './party.js';

/**
 * Lifecycle of an electronic document:
 * `draft → signed → submitted → accepted | accepted_with_notices | rejected`,
 * with `send_error` as a retryable state for transport failures (same XML,
 * idempotent). `rejected` is terminal: a correction needs a new number.
 */
export type DocumentStatus =
  'draft' | 'signed' | 'submitted' | 'accepted' | 'accepted_with_notices' | 'rejected' | 'send_error';

export const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'draft',
  'signed',
  'submitted',
  'accepted',
  'accepted_with_notices',
  'rejected',
  'send_error',
];

/** `PaymentMeans`: `form` is `ID` (1 cash / 2 credit) and `code` the means (10 cash, 47 transfer…). */
export interface PaymentMeans {
  form: PaymentForm;
  code: string;
  dueDate: string | null;
}

/** Invoice referenced by a credit/debit note (`BillingReference`, `DiscrepancyResponse/ReferenceID`). */
export interface BillingReference {
  documentId: number | null;
  number: string;
  uniqueCode: string;
  issueDate: string;
}

/** Concept of a credit/debit note (`DiscrepancyResponse`). */
export interface Discrepancy {
  code: string;
  description: string;
}

/** One interaction with the DIAN web service. */
export interface DianSubmission {
  id: number | null;
  operation: DianOperation;
  outcome: InterpretedResponse['outcome'] | 'transport_error';
  statusCode: string | null;
  statusMessage: string | null;
  errors: string[];
  trackId: string | null;
  at: Date;
}

/** Codes computed when the XML is generated and signed. */
export interface SignedArtifacts {
  uniqueCode: string;
  securityCode: string;
  qrUrl: string;
  fileNames: DianFileNames;
  signedXml: string;
}

export interface ElectronicDocumentProps {
  type: DocumentType;
  prefix: string;
  consecutive: number;
  cycle: number;
  number: string;
  environment: DianEnvironment;
  issueDate: string;
  issueTime: string;
  customer: Party;
  lines: DocumentLine[];
  paymentMeans: PaymentMeans;
  notes: string | null;
  billingReference: BillingReference | null;
  discrepancy: Discrepancy | null;
  sourcePaymentId: number | null;
  uniqueCode: string | null;
  securityCode: string | null;
  qrUrl: string | null;
  fileNames: DianFileNames | null;
  signedXml: string | null;
  status: DocumentStatus;
  operation: DianOperation | null;
  trackId: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  errors: string[];
  notices: string[];
  applicationResponse: string | null;
  attachedDocument: string | null;
  attempts: number;
  lastSubmissionAt: Date | null;
  submissions: DianSubmission[];
  createdAt: Date | null;
}

export interface IssueDocumentInput {
  type: DocumentType;
  reserved: ReservedNumber;
  environment: DianEnvironment;
  issuedAt: BogotaDateTime;
  customer: Party;
  lines: DocumentLine[];
  paymentMeans: PaymentMeans;
  notes?: string | null;
  billingReference?: BillingReference | null;
  discrepancy?: Discrepancy | null;
  sourcePaymentId?: number | null;
}

const MAX_LINES = 500;
const ACCEPTED: readonly DocumentStatus[] = ['accepted', 'accepted_with_notices'];
const SENDABLE: readonly DocumentStatus[] = ['signed', 'send_error'];

/**
 * Electronic invoice, credit note or debit note (`dian_invoices`).
 *
 * Fixes from the legacy (`generate_invoice.php`, `InvoiceGenerator.php`):
 * - Notes must explicitly reference the invoice (number, CUFE, date) and a
 *   valid discrepancy concept — no "last accepted invoice" guessing and no
 *   hard-coded `SETP990000001`.
 * - `PaymentMeans/ID` is the payment form (cash/credit) and credit requires a
 *   due date; the means code must be in the DIAN list.
 * - Documents are never stored unsigned: they become `signed` in the same
 *   transaction that consumed the number.
 */
export class ElectronicDocument extends Entity<ElectronicDocumentProps> {
  private constructor(id: EntityId, props: ElectronicDocumentProps) {
    super(id, props);
  }

  static issue(input: IssueDocumentInput): ElectronicDocument {
    if (input.lines.length === 0) {
      throw new BusinessRuleViolationError('El documento debe tener al menos una línea.', 'LINES_REQUIRED');
    }
    if (input.lines.length > MAX_LINES) {
      throw new BusinessRuleViolationError(`El documento no puede superar ${MAX_LINES} líneas.`, 'TOO_MANY_LINES');
    }
    ElectronicDocument.assertPaymentMeans(input.paymentMeans, input.issuedAt.date);
    ElectronicDocument.assertReference(input);
    const notes = input.notes?.trim() || null;
    Guard.againstMaxLength(notes, 2000, 'notas');

    return new ElectronicDocument(null, {
      type: input.type,
      prefix: input.reserved.prefix,
      consecutive: input.reserved.consecutive,
      cycle: input.reserved.cycle,
      number: input.reserved.number,
      environment: input.environment,
      issueDate: input.issuedAt.date,
      issueTime: input.issuedAt.time,
      customer: input.customer,
      lines: [...input.lines],
      paymentMeans: { ...input.paymentMeans },
      notes,
      billingReference: input.billingReference ?? null,
      discrepancy: input.discrepancy ?? null,
      sourcePaymentId: input.sourcePaymentId ?? null,
      uniqueCode: null,
      securityCode: null,
      qrUrl: null,
      fileNames: null,
      signedXml: null,
      status: 'draft',
      operation: null,
      trackId: null,
      statusCode: null,
      statusMessage: null,
      errors: [],
      notices: [],
      applicationResponse: null,
      attachedDocument: null,
      attempts: 0,
      lastSubmissionAt: null,
      submissions: [],
      createdAt: null,
    });
  }

  static restore(id: number, props: ElectronicDocumentProps): ElectronicDocument {
    return new ElectronicDocument(id, { ...props, submissions: [...props.submissions] });
  }

  private static assertPaymentMeans(means: PaymentMeans, issueDate: string): void {
    Guard.oneOf(means.form, ['1', '2'] as const, 'forma de pago');
    if (!isCatalogCode(PAYMENT_MEANS, means.code)) {
      throw new BusinessRuleViolationError(`Medio de pago no válido: ${means.code}.`, 'INVALID_PAYMENT_MEANS');
    }
    if (means.form === '2' && !means.dueDate) {
      throw new BusinessRuleViolationError('Una venta a crédito requiere fecha de vencimiento.', 'DUE_DATE_REQUIRED');
    }
    if (means.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(means.dueDate) || means.dueDate < issueDate)) {
      throw new BusinessRuleViolationError(
        'La fecha de vencimiento no puede ser anterior a la emisión.',
        'INVALID_DUE_DATE',
      );
    }
  }

  private static assertReference(input: IssueDocumentInput): void {
    if (input.type === 'fv') {
      if (input.billingReference || input.discrepancy) {
        throw new BusinessRuleViolationError('Una factura no referencia otro documento.', 'UNEXPECTED_REFERENCE');
      }
      return;
    }
    if (!input.billingReference?.uniqueCode || !input.billingReference.number) {
      throw new BusinessRuleViolationError('La nota debe referenciar una factura electrónica.', 'REFERENCE_REQUIRED');
    }
    const concepts = input.type === 'nc' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS;
    if (!input.discrepancy || !isCatalogCode(concepts, input.discrepancy.code)) {
      throw new BusinessRuleViolationError('Concepto de corrección (discrepancia) inválido.', 'INVALID_DISCREPANCY');
    }
    Guard.againstEmpty(input.discrepancy.description, 'descripción de la corrección');
  }

  get type(): DocumentType {
    return this.props.type;
  }
  get prefix(): string {
    return this.props.prefix;
  }
  get consecutive(): number {
    return this.props.consecutive;
  }
  get cycle(): number {
    return this.props.cycle;
  }
  get number(): string {
    return this.props.number;
  }
  get environment(): DianEnvironment {
    return this.props.environment;
  }
  get issueDate(): string {
    return this.props.issueDate;
  }
  get issueTime(): string {
    return this.props.issueTime;
  }
  get customer(): Party {
    return this.props.customer;
  }
  get lines(): readonly DocumentLine[] {
    return this.props.lines;
  }
  get totals(): DocumentTotals {
    return computeTotals(this.props.lines);
  }
  get paymentMeans(): PaymentMeans {
    return this.props.paymentMeans;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get billingReference(): BillingReference | null {
    return this.props.billingReference;
  }
  get discrepancy(): Discrepancy | null {
    return this.props.discrepancy;
  }
  get sourcePaymentId(): number | null {
    return this.props.sourcePaymentId;
  }
  get uniqueCode(): string | null {
    return this.props.uniqueCode;
  }
  get securityCode(): string | null {
    return this.props.securityCode;
  }
  get qrUrl(): string | null {
    return this.props.qrUrl;
  }
  get fileNames(): DianFileNames | null {
    return this.props.fileNames;
  }
  get signedXml(): string | null {
    return this.props.signedXml;
  }
  get status(): DocumentStatus {
    return this.props.status;
  }
  get operation(): DianOperation | null {
    return this.props.operation;
  }
  get trackId(): string | null {
    return this.props.trackId;
  }
  get statusCode(): string | null {
    return this.props.statusCode;
  }
  get statusMessage(): string | null {
    return this.props.statusMessage;
  }
  get errors(): readonly string[] {
    return this.props.errors;
  }
  get notices(): readonly string[] {
    return this.props.notices;
  }
  get applicationResponse(): string | null {
    return this.props.applicationResponse;
  }
  get attachedDocument(): string | null {
    return this.props.attachedDocument;
  }
  get attempts(): number {
    return this.props.attempts;
  }
  get lastSubmissionAt(): Date | null {
    return this.props.lastSubmissionAt;
  }
  get submissions(): readonly DianSubmission[] {
    return this.props.submissions;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get isAccepted(): boolean {
    return ACCEPTED.includes(this.props.status);
  }
  /** `ACCEPTED`, `ACCEPTED_WITH_NOTICES` and `REJECTED` are final. */
  get isFinal(): boolean {
    return this.isAccepted || this.props.status === 'rejected';
  }
  get canBeSubmitted(): boolean {
    return SENDABLE.includes(this.props.status);
  }

  /** Stores the signed XML and its codes (`draft → signed`). */
  sign(artifacts: SignedArtifacts): void {
    if (this.props.status !== 'draft') {
      throw new ConflictError('Solo se puede firmar un documento en borrador.');
    }
    Guard.againstEmpty(artifacts.signedXml, 'XML firmado');
    Object.assign(this.props, { ...artifacts, status: 'signed' satisfies DocumentStatus });
  }

  /** Fails unless the document can be (re)sent: only `signed` or `send_error`. */
  assertSubmittable(): void {
    if (!this.canBeSubmitted) {
      throw new BusinessRuleViolationError(
        `El documento ${this.number} está en estado "${this.props.status}" y no puede reenviarse. Un documento rechazado se corrige con un número nuevo.`,
        'DOCUMENT_NOT_SUBMITTABLE',
      );
    }
  }

  /** Fails unless the document is waiting for an asynchronous DIAN validation. */
  assertStatusQueryable(): void {
    if (this.props.status !== 'submitted' || !this.props.trackId) {
      throw new BusinessRuleViolationError(
        'El documento no tiene una validación DIAN pendiente.',
        'STATUS_NOT_PENDING',
      );
    }
  }

  /**
   * Applies a DIAN answer. Send operations count as an attempt; a status query
   * only moves a `submitted` document. Returns true when the document reached a
   * final state with this response.
   */
  applyResponse(operation: DianOperation, response: DianResponse, interpreted: InterpretedResponse, at: Date): boolean {
    this.assertTransition(operation);
    const statusByOutcome: Record<InterpretedResponse['outcome'], DocumentStatus> = {
      accepted: 'accepted',
      accepted_with_notices: 'accepted_with_notices',
      rejected: 'rejected',
      processing: 'submitted',
    };
    const wasFinal = this.isFinal;
    this.track(operation, at);
    Object.assign(this.props, {
      status: statusByOutcome[interpreted.outcome],
      // A status query answers with the CUFE as key; the ZipKey must be kept for later queries.
      trackId:
        operation === 'GetStatusZip'
          ? this.props.trackId
          : (response.trackId ?? this.props.trackId ?? this.props.uniqueCode),
      statusCode: response.statusCode,
      statusMessage: response.statusDescription,
      errors: interpreted.errors,
      notices: interpreted.notices,
      applicationResponse: response.applicationResponse ?? this.props.applicationResponse,
    });
    this.props.submissions.push({
      id: null,
      operation,
      outcome: interpreted.outcome,
      statusCode: response.statusCode,
      statusMessage: response.statusDescription,
      errors: [...interpreted.errors, ...interpreted.notices],
      trackId: response.trackId,
      at,
    });
    return !wasFinal && this.isFinal;
  }

  /** Network/HTTP failure: a send leaves the document retryable in `send_error`; a query changes nothing but the log. */
  recordTransportError(operation: DianOperation, message: string, at: Date): void {
    this.assertTransition(operation);
    this.track(operation, at);
    if (operation !== 'GetStatusZip') {
      this.props.status = 'send_error';
      this.props.statusMessage = message;
    }
    this.props.submissions.push({
      id: null,
      operation,
      outcome: 'transport_error',
      statusCode: null,
      statusMessage: message,
      errors: [message],
      trackId: null,
      at,
    });
  }

  /** Identities generated by persistence for the submissions not saved yet, in order. */
  assignSubmissionIds(ids: number[]): void {
    const pending = this.props.submissions.filter((submission) => submission.id === null);
    if (pending.length !== ids.length) throw new Error('Cantidad de identificadores de envío inválida.');
    pending.forEach((submission, index) => (submission.id = ids[index]));
  }

  /** Stores the AttachedDocument delivered to the acquirer (only for accepted documents). */
  attachContainer(attachedDocumentXml: string): void {
    if (!this.isAccepted) {
      throw new BusinessRuleViolationError(
        'Solo un documento validado por la DIAN tiene AttachedDocument.',
        'DOCUMENT_NOT_ACCEPTED',
      );
    }
    this.props.attachedDocument = attachedDocumentXml;
  }

  /**
   * True when a credit/debit note may reference this document: an accepted
   * invoice, or (habilitation test set) an invoice already sent to the set.
   */
  get isReferenceable(): boolean {
    if (this.props.type !== 'fv') return false;
    return this.isAccepted || (this.props.status === 'submitted' && this.props.operation === 'SendTestSetAsync');
  }

  private assertTransition(operation: DianOperation): void {
    if (operation === 'GetStatusZip') this.assertStatusQueryable();
    else this.assertSubmittable();
  }

  private track(operation: DianOperation, at: Date): void {
    if (operation !== 'GetStatusZip') {
      this.props.operation = operation;
      this.props.attempts += 1;
    }
    this.props.lastSubmissionAt = at;
  }
}
