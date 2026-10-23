import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { toDocumentDetailView, type DocumentDetailView } from './document-view.js';
import { DocumentSubmitter } from './services/document-submitter.js';

/**
 * Manual (re)submission of a document that was never sent or failed in
 * transport (`signed` / `send_error`), with the same signed XML. Rejected
 * documents cannot be resent (legacy `resend_invoice.php` resent them and
 * always used SendBillSync, even for the test set).
 */
@Injectable()
export class SubmitDocumentUseCase implements UseCase<number, DocumentDetailView> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(documentId: number): Promise<DocumentDetailView> {
    const document = await this.documents.findById(documentId);
    if (!document) throw new NotFoundError('Documento electrónico', documentId);
    return toDocumentDetailView(await this.submitter.submit(document));
  }
}
