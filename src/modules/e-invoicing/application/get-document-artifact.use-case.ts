import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { ZIP_ARCHIVER, type ZipArchiverPort } from './ports/zip-archiver.port.js';
import { DocumentSubmitter } from './services/document-submitter.js';

export type ArtifactKind = 'xml' | 'zip' | 'application-response' | 'attached-document';
export const ARTIFACT_KINDS: readonly ArtifactKind[] = ['xml', 'zip', 'application-response', 'attached-document'];

export interface DocumentArtifact {
  fileName: string;
  contentType: string;
  content: Buffer;
}

/**
 * Downloads a document artifact: the signed XML, the ZIP sent to the DIAN,
 * the DIAN `ApplicationResponse` or the `AttachedDocument` for the acquirer
 * (generated on first request if it is missing).
 */
@Injectable()
export class GetDocumentArtifactUseCase implements UseCase<
  { documentId: number; kind: ArtifactKind },
  DocumentArtifact
> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(ZIP_ARCHIVER) private readonly zipper: ZipArchiverPort,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute({ documentId, kind }: { documentId: number; kind: ArtifactKind }): Promise<DocumentArtifact> {
    const document = await this.documents.findById(documentId);
    if (!document) throw new NotFoundError('Documento electrónico', documentId);
    const xmlName = `${document.fileNames?.xml ?? document.number}.xml`;
    switch (kind) {
      case 'xml':
        return xmlArtifact(xmlName, requireContent(document.signedXml, 'XML firmado'));
      case 'zip':
        return {
          fileName: `${document.fileNames?.zip ?? document.number}.zip`,
          contentType: 'application/zip',
          content: this.zipper.zip(xmlName, requireContent(document.signedXml, 'XML firmado')),
        };
      case 'application-response':
        return xmlArtifact(
          `ar-${document.number}.xml`,
          requireContent(document.applicationResponse, 'ApplicationResponse'),
        );
      case 'attached-document':
        return xmlArtifact(`ad-${document.number}.xml`, await this.submitter.ensureAttachedDocument(document));
    }
  }
}

const xmlArtifact = (fileName: string, xml: string): DocumentArtifact => ({
  fileName,
  contentType: 'application/xml; charset=utf-8',
  content: Buffer.from(xml, 'utf8'),
});

function requireContent(content: string | null, name: string): string {
  if (!content) {
    throw new BusinessRuleViolationError(`El documento no tiene ${name} disponible.`, 'ARTIFACT_UNAVAILABLE');
  }
  return content;
}
