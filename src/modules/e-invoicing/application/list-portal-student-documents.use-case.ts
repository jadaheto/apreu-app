import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { PageRequest, Paginated } from '../../../shared/domain/pagination.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { PORTAL_HIDDEN_STATUSES, toPortalDocumentView, type PortalDocumentView } from './portal-document-view.js';
import { PortalStudentAccess } from './portal-student-access.js';

export interface ListPortalStudentDocumentsInput {
  actor: AuthenticatedActor;
  studentId: number;
  page: PageRequest;
}

/**
 * Electronic invoices and notes of one student for the student/guardian
 * portal, newest first. Only documents generated from the student's payments
 * (automatic invoicing and the notes that inherit the payment); ownership is
 * verified with {@link PortalStudentAccess}.
 */
@Injectable()
export class ListPortalStudentDocumentsUseCase implements UseCase<
  ListPortalStudentDocumentsInput,
  Paginated<PortalDocumentView>
> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly access: PortalStudentAccess,
  ) {}

  async execute({ actor, studentId, page }: ListPortalStudentDocumentsInput): Promise<Paginated<PortalDocumentView>> {
    const paymentIds = await this.access.paymentIdsVisibleTo(actor, studentId);
    const result = await this.documents.search(
      { sourcePaymentIds: paymentIds, excludeStatuses: PORTAL_HIDDEN_STATUSES },
      page,
    );
    return { ...result, items: result.items.map(toPortalDocumentView) };
  }
}
