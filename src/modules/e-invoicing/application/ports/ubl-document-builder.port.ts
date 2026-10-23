import type { ElectronicDocument } from '../../domain/electronic-document.js';
import type { IssuerConfig } from '../../domain/issuer-config.js';
import type { NumberingResolution } from '../../domain/numbering-resolution.js';

/** Comment left where the XAdES signature must be inserted (second `ext:UBLExtension`). */
export const SIGNATURE_PLACEHOLDER = '<!-- SIGNATURE_PLACEHOLDER -->';

export interface UblBuildInput {
  /** Draft document whose number, lines and parties are final. */
  document: ElectronicDocument;
  issuer: IssuerConfig;
  /** Resolution that numbered the document (InvoiceControl of invoices). */
  resolution: NumberingResolution;
  uniqueCode: string;
  securityCode: string;
  qrUrl: string;
}

/** Builds the UBL 2.1 XML (Invoice / CreditNote / DebitNote) with the signature placeholder. */
export interface UblDocumentBuilderPort {
  build(input: UblBuildInput): string;
}

export const UBL_DOCUMENT_BUILDER = Symbol('UblDocumentBuilderPort');
