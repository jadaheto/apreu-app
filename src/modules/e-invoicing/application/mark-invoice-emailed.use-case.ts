import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import type { InvoiceEmailSentPayload } from './integration-events.js';

/**
 * Reacts to `communications.invoice-email-sent`: flags the document as
 * delivered to the buyer (legacy `dian_invoices.email_sent`). Unknown ids are
 * ignored so a stale event never fails the publisher.
 */
@Injectable()
export class MarkInvoiceEmailedUseCase implements UseCase<InvoiceEmailSentPayload, void> {
  constructor(@Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository) {}

  async execute(payload: InvoiceEmailSentPayload): Promise<void> {
    const document = await this.documents.findById(payload.dianInvoiceId);
    if (!document) return;
    await this.documents.markEmailSent(payload.dianInvoiceId, new Date(payload.sentAt));
  }
}
