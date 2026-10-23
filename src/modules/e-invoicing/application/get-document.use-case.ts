import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { toDocumentDetailView, type DocumentDetailView } from './document-view.js';

/** Detail of a document with lines, DIAN answer and submission history (legacy `get_invoice.php`, now authenticated). */
@Injectable()
export class GetDocumentUseCase implements UseCase<number, DocumentDetailView> {
  constructor(@Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository) {}

  async execute(documentId: number): Promise<DocumentDetailView> {
    const document = await this.documents.findById(documentId);
    if (!document) throw new NotFoundError('Documento electrónico', documentId);
    return toDocumentDetailView(document);
  }
}
