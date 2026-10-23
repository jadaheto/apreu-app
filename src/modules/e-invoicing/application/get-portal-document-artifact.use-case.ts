import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import type { ElectronicDocument } from '../domain/electronic-document.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import type { NumberingResolution } from '../domain/numbering-resolution.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../domain/numbering-resolution.repository.js';
import type { DocumentArtifact } from './get-document-artifact.use-case.js';
import { INVOICE_PDF_RENDERER, type InvoicePdfRendererPort } from './ports/invoice-pdf-renderer.port.js';
import { availablePortalArtifacts, PORTAL_HIDDEN_STATUSES, type PortalArtifact } from './portal-document-view.js';
import { PortalStudentAccess } from './portal-student-access.js';
import { DocumentSubmitter } from './services/document-submitter.js';

export interface GetPortalDocumentArtifactInput {
  actor: AuthenticatedActor;
  studentId: number;
  documentId: number;
  artifact: PortalArtifact;
}

/**
 * Downloads, from the student/guardian portal, the PDF (graphic
 * representation) or the XML (`AttachedDocument`) of a DIAN-validated
 * document of the student. A document of another student answers 404 (its
 * existence is not disclosed); a document not validated yet answers 422
 * `ARTIFACT_UNAVAILABLE`.
 */
@Injectable()
export class GetPortalDocumentArtifactUseCase implements UseCase<GetPortalDocumentArtifactInput, DocumentArtifact> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly issuerConfigs: IssuerConfigRepository,
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(INVOICE_PDF_RENDERER) private readonly pdf: InvoicePdfRendererPort,
    private readonly submitter: DocumentSubmitter,
    private readonly access: PortalStudentAccess,
  ) {}

  async execute({ actor, studentId, documentId, artifact }: GetPortalDocumentArtifactInput): Promise<DocumentArtifact> {
    const paymentIds = await this.access.paymentIdsVisibleTo(actor, studentId);
    const document = await this.documents.findById(documentId);
    if (
      !document ||
      document.sourcePaymentId === null ||
      !paymentIds.includes(document.sourcePaymentId) ||
      PORTAL_HIDDEN_STATUSES.includes(document.status)
    ) {
      throw new NotFoundError('Documento electrónico', documentId);
    }
    if (!availablePortalArtifacts(document).includes(artifact)) {
      throw new BusinessRuleViolationError(
        'El documento aún no está validado por la DIAN; el archivo no está disponible.',
        'ARTIFACT_UNAVAILABLE',
      );
    }
    if (artifact === 'xml') {
      return {
        fileName: `ad-${document.number}.xml`,
        contentType: 'application/xml; charset=utf-8',
        content: Buffer.from(await this.submitter.ensureAttachedDocument(document), 'utf8'),
      };
    }
    const [issuer, resolution] = await Promise.all([this.issuerConfigs.get(), this.resolutionOf(document)]);
    return this.pdf.render({ document, issuer, resolution });
  }

  /** Resolution of the same type and prefix whose range contains the consecutive. */
  private async resolutionOf(document: ElectronicDocument): Promise<NumberingResolution | null> {
    const candidates = await this.resolutions.findByPrefix(document.prefix);
    return (
      candidates.find(
        (r) =>
          r.docType === document.type &&
          r.environment === document.environment &&
          document.consecutive >= r.rangeFrom &&
          document.consecutive <= r.rangeTo,
      ) ?? null
    );
  }
}
