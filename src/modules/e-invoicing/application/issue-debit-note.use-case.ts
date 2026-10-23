import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { DocumentLineInput } from '../domain/document-line.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { toDocumentDetailView, type DocumentDetailView } from './document-view.js';
import { toLines } from './services/document-inputs.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';
import { discrepancyFor, loadReferencedInvoice, referenceTo } from './services/referenced-invoice.js';

export interface IssueDebitNoteInput {
  invoiceId: number;
  /** Concept (1 intereses, 2 gastos por cobrar, 3 cambio del valor, 4 otros). */
  conceptCode: string;
  description?: string | null;
  lines: DocumentLineInput[];
  notes?: string | null;
}

/** Issues a debit note (ND) that explicitly references a validated invoice and reuses its acquirer. */
@Injectable()
export class IssueDebitNoteUseCase implements UseCase<IssueDebitNoteInput, DocumentDetailView> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(input: IssueDebitNoteInput): Promise<DocumentDetailView> {
    const invoice = await loadReferencedInvoice(this.documents, input.invoiceId);
    const document = await this.issuer.issue({
      type: 'nd',
      customer: invoice.customer,
      lines: toLines(input.lines),
      paymentMeans: { ...invoice.paymentMeans },
      notes: input.notes,
      billingReference: referenceTo(invoice),
      discrepancy: discrepancyFor('nd', input.conceptCode, input.description),
      sourcePaymentId: invoice.sourcePaymentId,
    });
    return toDocumentDetailView(await this.submitter.submit(document));
  }
}
