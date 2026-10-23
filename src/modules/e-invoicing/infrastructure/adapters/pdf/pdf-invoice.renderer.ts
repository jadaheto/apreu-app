import { Injectable } from '@nestjs/common';
import {
  DocumentBrandingProvider,
  type DocumentBranding,
} from '../../../../../shared/infrastructure/documents/document-branding.js';
import {
  dataTable,
  formatCop,
  formatDecimal,
  institutionalDocument,
} from '../../../../../shared/infrastructure/documents/institutional-layout.js';
import {
  renderPdf,
  type PdfContent,
  type PdfDocumentDefinition,
} from '../../../../../shared/infrastructure/documents/pdf-document.js';
import type { DocumentArtifact } from '../../../application/get-document-artifact.use-case.js';
import type { InvoicePdfInput, InvoicePdfRendererPort } from '../../../application/ports/invoice-pdf-renderer.port.js';
import { Amounts } from '../../../domain/amounts.js';
import {
  catalogName,
  CREDIT_NOTE_CONCEPTS,
  DEBIT_NOTE_CONCEPTS,
  type DocumentType,
  IDENTIFICATION_TYPES,
  PAYMENT_FORMS,
  PAYMENT_MEANS,
  TAX_RESPONSIBILITIES,
  VAT_REGIMES,
} from '../../../domain/catalogs.js';

const TITLES: Record<DocumentType, string> = {
  fv: 'Factura electrónica de venta',
  nc: 'Nota crédito electrónica',
  nd: 'Nota débito electrónica',
};

const money = (cents: number) => formatCop(Amounts.toNumber(cents));

const labelled = (label: string, value: string | null | undefined): PdfContent =>
  value ? { text: [{ text: `${label}: `, bold: true }, value], margin: [0, 0, 0, 1] } : '';

const box = (title: string, rows: PdfContent[], color: string): PdfContent => ({
  stack: [{ text: title, style: 'sectionTitle', color, margin: [0, 0, 0, 3] }, ...rows],
});

/**
 * pdfmake definition of the graphic representation of an electronic invoice
 * or note (Resolución DIAN 000165 de 2023: issuer and acquirer data, number,
 * date and time, lines, totals, payment, CUFE/CUDE and QR, numbering
 * authorization). Replaces legacy `finance/invoice_pdf.php`.
 */
export const invoicePdfDefinition = (
  { document, issuer, resolution }: InvoicePdfInput,
  branding: DocumentBranding,
): PdfDocumentDefinition => {
  const color = branding.primaryColor;
  const totals = document.totals;
  const customer = document.customer;
  const codeName = document.type === 'fv' ? 'CUFE' : 'CUDE';
  const reference = document.billingReference;
  const concepts = document.type === 'nc' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS;
  const responsibilities = issuer.taxResponsibilities
    .split(';')
    .map((code) => catalogName(TAX_RESPONSIBILITIES, code) ?? code)
    .join(', ');
  const location = (l: { cityName: string; departmentName: string }) =>
    [l.cityName, l.departmentName].filter(Boolean).join(', ') || null;

  const parties: PdfContent = {
    columns: [
      box(
        'Emisor',
        [
          { text: issuer.businessName, bold: true },
          labelled('NIT', `${issuer.nit}-${issuer.dv}`),
          labelled('Dirección', [issuer.address, location(issuer.location)].filter(Boolean).join(' · ')),
          labelled('Régimen', catalogName(VAT_REGIMES, issuer.vatRegime)),
          labelled('Responsabilidades', responsibilities),
          labelled('Teléfono', issuer.phone),
          labelled('Correo', issuer.email),
        ],
        color,
      ),
      box(
        'Adquiriente',
        [
          { text: customer.name, bold: true },
          labelled(
            catalogName(IDENTIFICATION_TYPES, customer.idType) ?? 'Identificación',
            customer.dv ? `${customer.idNumber}-${customer.dv}` : customer.idNumber,
          ),
          labelled('Dirección', [customer.address, location(customer.location)].filter(Boolean).join(' · ')),
          labelled('Teléfono', customer.phone),
          labelled('Correo', customer.email),
        ],
        color,
      ),
    ],
    columnGap: 16,
    margin: [0, 0, 0, 8],
  };

  const header: PdfContent = {
    columns: [
      labelled('Fecha de emisión', `${document.issueDate} ${document.issueTime}`),
      labelled('Forma de pago', catalogName(PAYMENT_FORMS, document.paymentMeans.form)),
      labelled('Medio de pago', catalogName(PAYMENT_MEANS, document.paymentMeans.code)),
      labelled('Vencimiento', document.paymentMeans.dueDate),
    ],
    margin: [0, 0, 0, 8],
  };

  const lines = dataTable(
    [
      { header: '#', width: 18, align: 'center' },
      { header: 'Descripción', width: '*' },
      { header: 'Cant.', width: 40, align: 'right' },
      { header: 'Valor unitario', width: 80, align: 'right' },
      { header: 'IVA %', width: 40, align: 'right' },
      { header: 'IVA', width: 60, align: 'right' },
      { header: 'Total', width: 80, align: 'right' },
    ],
    document.lines.map((line, index) => [
      index + 1,
      line.description,
      formatDecimal(line.quantityHundredths / 100),
      money(line.unitPriceCents),
      line.reportsTax ? formatDecimal(line.taxRateBasisPoints / 100) : 'Excluido',
      money(line.taxCents),
      money(line.lineTotalCents + line.taxCents),
    ]),
    { color, fontSize: 8.5 },
  );

  const totalsTable: PdfContent = {
    columns: [
      { width: '*', text: '' },
      {
        width: 220,
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Subtotal', { text: money(totals.lineExtensionCents), alignment: 'right' }],
            ['IVA', { text: money(totals.taxCents), alignment: 'right' }],
            [
              { text: 'Total', bold: true },
              { text: money(totals.payableCents), bold: true, alignment: 'right' },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    margin: [0, 8, 0, 8],
  };

  const referenceBlock: PdfContent = reference
    ? box(
        'Documento referenciado',
        [
          labelled('Factura', reference.number),
          labelled('Fecha', reference.issueDate),
          labelled('CUFE', reference.uniqueCode),
          labelled('Concepto', document.discrepancy ? (catalogName(concepts, document.discrepancy.code) ?? '') : null),
          labelled('Motivo', document.discrepancy?.description),
        ],
        color,
      )
    : '';

  const authorization = resolution?.resolutionNumber
    ? `Autorización de numeración DIAN No. ${resolution.resolutionNumber}` +
      (resolution.validFrom ? ` del ${resolution.validFrom}` : '') +
      (resolution.validTo ? ` vigente hasta ${resolution.validTo}` : '') +
      `, prefijo ${resolution.prefix} del ${resolution.rangeFrom} al ${resolution.rangeTo}.`
    : null;

  const validation: PdfContent = {
    columns: [
      {
        width: '*',
        stack: [
          labelled(codeName, document.uniqueCode),
          ...(authorization ? [{ text: authorization, style: 'muted', margin: [0, 4, 0, 0] }] : []),
          ...(document.environment === '2'
            ? [{ text: 'Documento emitido en ambiente de habilitación (pruebas): sin validez fiscal.', bold: true }]
            : []),
          ...(document.notes ? [{ text: document.notes, style: 'muted', margin: [0, 4, 0, 0] }] : []),
        ],
      },
      ...(document.qrUrl ? [{ qr: document.qrUrl, fit: 96, width: 104 }] : []),
    ],
    columnGap: 12,
    margin: [0, 10, 0, 0],
    unbreakable: true,
  };

  return institutionalDocument({
    branding,
    institution: {
      name: issuer.businessName || branding.institutionName || 'Institución',
      nit: `${issuer.nit}-${issuer.dv}`,
    },
    title: TITLES[document.type],
    subtitle: `No. ${document.number}`,
    content: [parties, header, lines, totalsTable, referenceBlock, validation],
    footerNote: `Representación gráfica de la ${TITLES[document.type].toLowerCase()} ${document.number} · Generado por Apreu`,
  });
};

/** Graphic representation of DIAN documents with the school letterhead (logo and color). */
@Injectable()
export class PdfInvoiceRenderer implements InvoicePdfRendererPort {
  constructor(private readonly branding: DocumentBrandingProvider) {}

  async render(input: InvoicePdfInput): Promise<DocumentArtifact> {
    const definition = invoicePdfDefinition(input, await this.branding.load());
    return {
      fileName: `${input.document.fileNames?.xml ?? input.document.number}.pdf`,
      contentType: 'application/pdf',
      content: await renderPdf(definition),
    };
  }
}
