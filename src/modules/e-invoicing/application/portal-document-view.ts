import { Amounts } from '../domain/amounts.js';
import type { DocumentType } from '../domain/catalogs.js';
import type { DocumentStatus, ElectronicDocument } from '../domain/electronic-document.js';

/** Files a student/guardian may download from the portal. */
export type PortalArtifact = 'pdf' | 'xml';
export const PORTAL_ARTIFACTS: readonly PortalArtifact[] = ['pdf', 'xml'];

/** Documents never shown in the portal: not valid before the DIAN (a correction gets a new number). */
export const PORTAL_HIDDEN_STATUSES: readonly DocumentStatus[] = ['draft', 'rejected'];

const TYPE_NAMES: Record<DocumentType, string> = {
  fv: 'Factura electrónica de venta',
  nc: 'Nota crédito',
  nd: 'Nota débito',
};

/** Electronic document as listed in the student/guardian portal (no DIAN internals). */
export interface PortalDocumentView {
  id: number;
  documentType: DocumentType;
  documentTypeName: string;
  /** Full number, prefix included (e.g. `FE1234`). */
  number: string;
  prefix: string;
  issueDate: string;
  totalAmount: number;
  status: DocumentStatus;
  /** CUFE (invoices) or CUDE (notes); `null` until signed. */
  cufe: string | null;
  /** Downloadable files: both require the DIAN validation. */
  artifacts: PortalArtifact[];
}

/**
 * Portal files of a document. The PDF (graphic representation) and the XML
 * (`AttachedDocument`, the container the DIAN requires to deliver to the
 * acquirer) only exist for documents validated by the DIAN.
 */
export const availablePortalArtifacts = (document: ElectronicDocument): PortalArtifact[] => {
  if (!document.isAccepted || !document.uniqueCode) return [];
  const xml = Boolean(document.attachedDocument || document.applicationResponse);
  return xml ? ['pdf', 'xml'] : ['pdf'];
};

export const toPortalDocumentView = (document: ElectronicDocument): PortalDocumentView => ({
  id: document.id as number,
  documentType: document.type,
  documentTypeName: TYPE_NAMES[document.type],
  number: document.number,
  prefix: document.prefix,
  issueDate: document.issueDate,
  totalAmount: Amounts.toNumber(document.totals.payableCents),
  status: document.status,
  cufe: document.uniqueCode,
  artifacts: availablePortalArtifacts(document),
});
