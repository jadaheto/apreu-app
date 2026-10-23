import { Injectable } from '@nestjs/common';
import {
  DocumentBrandingProvider,
  type DocumentBranding,
} from '../../../../shared/infrastructure/documents/document-branding.js';
import { institutionalDocument, signatures } from '../../../../shared/infrastructure/documents/institutional-layout.js';
import { renderPdf, type PdfDocumentDefinition } from '../../../../shared/infrastructure/documents/pdf-document.js';
import type { CertificateDocumentView } from '../../application/get-certificate-document.use-case.js';
import type {
  CertificateRendererPort,
  RenderedCertificate,
} from '../../application/ports/certificate-renderer.port.js';

const fileSafe = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

/**
 * pdfmake definition of the study certificate (layout §4.5b of the
 * students analysis; legacy `student/certificate.php`).
 */
export const certificateDefinition = (
  doc: CertificateDocumentView,
  branding: DocumentBranding,
  qr: string,
): PdfDocumentDefinition => {
  const code = doc.certificate.verificationCode as string;
  return institutionalDocument({
    branding,
    institution: { name: doc.institution.name, nit: doc.institution.nit || null, details: [doc.institution.city] },
    title: 'Certificado de estudios',
    subtitle: doc.certificate.snapshot ? `Año lectivo ${doc.certificate.snapshot.academicYear}` : undefined,
    verification: { code, qr },
    content: [
      {
        text: doc.text.title,
        style: 'documentTitle',
        alignment: 'center',
        color: branding.primaryColor,
        margin: [0, 24, 0, 18],
      },
      ...doc.text.paragraphs.map((paragraph) => ({ text: paragraph, style: 'paragraph' })),
      {
        text: `Expedido${doc.institution.city ? ` en ${doc.institution.city}` : ''} el ${doc.text.issuedOn}.`,
        margin: [0, 8, 0, 0],
      },
      signatures([{ name: doc.institution.rectorName || 'Rector(a)', role: 'Rector(a)' }]),
    ],
  });
};

/** Study certificate PDF with the school letterhead and the verification code + QR on every page. */
@Injectable()
export class PdfCertificateRenderer implements CertificateRendererPort {
  constructor(private readonly branding: DocumentBrandingProvider) {}

  async render(doc: CertificateDocumentView): Promise<RenderedCertificate> {
    const code = doc.certificate.verificationCode as string;
    const definition = certificateDefinition(
      doc,
      await this.branding.load(),
      this.branding.verificationTarget('estudiantil', code),
    );
    const student = doc.certificate.snapshot?.studentName ?? String(doc.certificate.studentId);
    return {
      fileName: `Certificado_${fileSafe(student)}_${code}.pdf`,
      contentType: 'application/pdf',
      content: await renderPdf(definition),
    };
  }
}
