import type { BogotaDateTime } from '../../domain/bogota-time.js';
import type { ElectronicDocument } from '../../domain/electronic-document.js';
import type { IssuerConfig } from '../../domain/issuer-config.js';

/**
 * Builds the `AttachedDocument` container delivered to the acquirer: the
 * signed document plus the DIAN `ApplicationResponse` (both as CDATA), with
 * the signature placeholder. Not implemented by the legacy system.
 */
export interface AttachedDocumentBuilderPort {
  build(document: ElectronicDocument, issuer: IssuerConfig, issuedAt: BogotaDateTime): string;
}

export const ATTACHED_DOCUMENT_BUILDER = Symbol('AttachedDocumentBuilderPort');
