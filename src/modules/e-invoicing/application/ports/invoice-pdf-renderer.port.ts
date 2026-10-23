import type { ElectronicDocument } from '../../domain/electronic-document.js';
import type { IssuerConfig } from '../../domain/issuer-config.js';
import type { NumberingResolution } from '../../domain/numbering-resolution.js';
import type { DocumentArtifact } from '../get-document-artifact.use-case.js';

export interface InvoicePdfInput {
  document: ElectronicDocument;
  issuer: IssuerConfig;
  /** Numbering resolution that authorized the number (printed legend), when found. */
  resolution: NumberingResolution | null;
}

/** Graphic representation (PDF) of a validated electronic invoice or note, with its CUFE/CUDE and DIAN QR. */
export interface InvoicePdfRendererPort {
  render(input: InvoicePdfInput): Promise<DocumentArtifact>;
}

export const INVOICE_PDF_RENDERER = Symbol('InvoicePdfRendererPort');
