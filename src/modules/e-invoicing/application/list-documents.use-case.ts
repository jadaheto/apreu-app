import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { mapPage, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import {
  type DocumentSearchCriteria,
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { toDocumentSummaryView, type DocumentSummaryView } from './document-view.js';

export interface ListDocumentsInput {
  criteria: DocumentSearchCriteria;
  page: PageRequest;
}

/** Paginated list of electronic documents filtered by type, status, issue dates and text. */
@Injectable()
export class ListDocumentsUseCase implements UseCase<ListDocumentsInput, Paginated<DocumentSummaryView>> {
  constructor(@Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository) {}

  async execute({ criteria, page }: ListDocumentsInput): Promise<Paginated<DocumentSummaryView>> {
    return mapPage(await this.documents.search(criteria, page), toDocumentSummaryView);
  }
}
