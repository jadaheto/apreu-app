import type {
  EmploymentCertificateContent,
  IncomeCertificateDocument,
  PayslipDocument,
} from '../documents/document-models.js';

/** A rendered, downloadable document. */
export interface RenderedDocument {
  contentType: string;
  fileName: string;
  body: string | Buffer;
}

/**
 * Turns document data into a downloadable file. The bundled adapter
 * (`PdfDocumentRenderer`) produces PDFs with the school letterhead.
 */
export interface DocumentRendererPort {
  payslip(document: PayslipDocument): Promise<RenderedDocument>;
  employmentCertificate(content: EmploymentCertificateContent): Promise<RenderedDocument>;
  incomeCertificate(document: IncomeCertificateDocument): Promise<RenderedDocument>;
}

export const DOCUMENT_RENDERER = Symbol('DocumentRendererPort');
