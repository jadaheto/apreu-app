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
 * Queries the DIAN (`GetStatusZip`) for a submitted document (legacy
 * `check_status.php`): the returned ZIP is uncompressed and codes 66/90
 * ("en proceso") keep the document `submitted` instead of rejecting it.
 */
@Injectable()
export class CheckDocumentStatusUseCase implements UseCase<number, DocumentDetailView> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(documentId: number): Promise<DocumentDetailView> {
    const document = await this.documents.findById(documentId);
    if (!document) throw new NotFoundError('Documento electrónico', documentId);
    return toDocumentDetailView(await this.submitter.checkStatus(document));
  }
}
