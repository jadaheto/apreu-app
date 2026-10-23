import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  ISSUED_DOCUMENT_REPOSITORY,
  type IssuedDocumentRepository,
  normalizeVerificationCode,
} from '../../domain/documents/issued-document.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import {
  DOCUMENT_RENDERER,
  type DocumentRendererPort,
  type RenderedDocument,
} from '../ports/document-renderer.port.js';
import type { EmploymentCertificateContent } from './document-models.js';

export interface RenderIssuedDocumentInput {
  actor: AuthenticatedActor;
  code: string;
}

/** Printable copy of an issued certificate, for HR or the employee it belongs to. */
@Injectable()
export class RenderIssuedDocumentUseCase implements UseCase<RenderIssuedDocumentInput, RenderedDocument> {
  constructor(
    @Inject(ISSUED_DOCUMENT_REPOSITORY) private readonly documents: IssuedDocumentRepository,
    @Inject(DOCUMENT_RENDERER) private readonly renderer: DocumentRendererPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, code }: RenderIssuedDocumentInput): Promise<RenderedDocument> {
    const document = await this.documents.findByCode(normalizeVerificationCode(code));
    const allowed =
      document !== null && (isHrManager(actor) || (await this.currentEmployee.find(actor))?.id === document.employeeId);
    if (!document || !allowed) throw new NotFoundError('Documento', code);
    return this.renderer.employmentCertificate(document.content as unknown as EmploymentCertificateContent);
  }
}
