import type { CertificateDocumentView } from '../get-certificate-document.use-case.js';

/** A rendered, downloadable file. */
export interface RenderedCertificate {
  fileName: string;
  contentType: string;
  content: Buffer;
}

/** Renders a printable study certificate (PDF with letterhead and verification QR). */
export interface CertificateRendererPort {
  render(document: CertificateDocumentView): Promise<RenderedCertificate>;
}

export const CERTIFICATE_RENDERER = Symbol('CertificateRendererPort');
