import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Amounts } from '../domain/amounts.js';
import { computeTotals, DocumentLine, type DocumentLineInput } from '../domain/document-line.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { toDocumentDetailView, type DocumentDetailView } from './document-view.js';
import { toLines } from './services/document-inputs.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';
import { discrepancyFor, loadReferencedInvoice, referenceTo } from './services/referenced-invoice.js';

export interface IssueCreditNoteInput {
  invoiceId: number;
  /** Concept (1 devolución, 2 anulación, 3 descuento, 4 ajuste de precio, 5 otros). */
  conceptCode: string;
  description?: string | null;
  /** Lines to credit; omitted only for a full annulment (concept 2), which copies the invoice lines. */
  lines?: DocumentLineInput[];
  notes?: string | null;
  /** Finance payment that originated the note (payment voided). */
  sourcePaymentId?: number | null;
}

/**
 * Issues a credit note (NC) that explicitly references an invoice.
 *
 * Rules: the invoice must be validated by the DIAN; the note uses the
 * invoice's acquirer and payment means; the credited total (this note plus
 * previous non-rejected credit notes) cannot exceed the invoice total.
 */
@Injectable()
export class IssueCreditNoteUseCase implements UseCase<IssueCreditNoteInput, DocumentDetailView> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(input: IssueCreditNoteInput): Promise<DocumentDetailView> {
    const invoice = await loadReferencedInvoice(this.documents, input.invoiceId);
    const lines = input.lines?.length
      ? toLines(input.lines)
      : input.conceptCode === '2'
        ? invoice.lines.map((line) => DocumentLine.restore(line.toProps()))
        : [];
    if (lines.length === 0) {
      throw new BusinessRuleViolationError('Indique las líneas a acreditar.', 'LINES_REQUIRED');
    }

    const alreadyCredited = await this.documents.creditedTotalCents(invoice.id as number);
    const available = invoice.totals.payableCents - alreadyCredited;
    if (computeTotals(lines).payableCents > available) {
      throw new BusinessRuleViolationError(
        `El valor de la nota supera el saldo disponible de la factura (${Amounts.format(available)}).`,
        'CREDIT_EXCEEDS_INVOICE',
        { available: Amounts.toNumber(available) },
      );
    }

    const document = await this.issuer.issue({
      type: 'nc',
      customer: invoice.customer,
      lines,
      paymentMeans: { ...invoice.paymentMeans },
      notes: input.notes,
      billingReference: referenceTo(invoice),
      discrepancy: discrepancyFor('nc', input.conceptCode, input.description),
      sourcePaymentId: input.sourcePaymentId ?? invoice.sourcePaymentId,
    });
    return toDocumentDetailView(await this.submitter.submit(document));
  }
}
