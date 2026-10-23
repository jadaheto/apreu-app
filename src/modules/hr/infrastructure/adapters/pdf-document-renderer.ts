import { Injectable } from '@nestjs/common';
import {
  DocumentBrandingProvider,
  type DocumentBranding,
} from '../../../../shared/infrastructure/documents/document-branding.js';
import {
  dataTable,
  formatCop,
  institutionalDocument,
  signatures,
  type LetterheadInstitution,
} from '../../../../shared/infrastructure/documents/institutional-layout.js';
import {
  renderPdf,
  type PdfContent,
  type PdfDocumentDefinition,
} from '../../../../shared/infrastructure/documents/pdf-document.js';
import type {
  EmploymentCertificateContent,
  IncomeCertificateDocument,
  PayslipDocument,
  PayslipLine,
} from '../../application/documents/document-models.js';
import type { DocumentRendererPort, RenderedDocument } from '../../application/ports/document-renderer.port.js';
import type { InstitutionProfile } from '../../domain/documents/institution-profile.port.js';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-03-15` → `15 de marzo de 2026`. */
export const longDate = (iso: string | null): string => {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
};

const fileSafe = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const letterhead = (institution: InstitutionProfile): LetterheadInstitution => ({
  name: institution.name,
  nit: institution.nit
    ? `${institution.nit}${institution.nitVerificationDigit ? `-${institution.nitVerificationDigit}` : ''}`
    : null,
  details: [institution.address, institution.city],
});

const amountTable = (title: string, lines: PayslipLine[], total: string, totalAmount: number, color: string) =>
  dataTable(
    [{ header: title }, { header: '', align: 'right', width: 'auto' }],
    [...lines.map((line) => [line.label, formatCop(line.amount)]), [total, formatCop(totalAmount)]],
    { color, emphasize: (_, index) => index === lines.length },
  );

/** pdfmake definition of a payslip (legacy `hr/print_payslip.php`). */
export const payslipDefinition = (doc: PayslipDocument, branding: DocumentBranding): PdfDocumentDefinition => {
  const { employee, period } = doc;
  const color = branding.primaryColor;
  const bank = employee.bank.name
    ? `${employee.bank.name} — ${employee.bank.type.toUpperCase()} ${employee.bank.maskedAccount ?? ''}`.trim()
    : 'Sin cuenta registrada';
  const employeeBand: PdfContent = {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          {
            stack: [
              { text: employee.fullName, bold: true },
              { text: `${employee.document} · ${employee.code}`, style: 'muted' },
            ],
          },
          { stack: [`Cargo: ${employee.position ?? '—'}`, `Departamento: ${employee.department ?? '—'}`] },
          { stack: [`Contrato: ${employee.contract}`, `Días liquidados: ${doc.workedDays}`] },
          { stack: ['Fecha de pago:', { text: longDate(period.paymentDate), bold: true }] },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 10],
  };
  return institutionalDocument({
    branding,
    institution: letterhead(doc.institution),
    title: 'Desprendible de pago',
    subtitle: period.label,
    content: [
      employeeBand,
      {
        columns: [
          amountTable('+ Devengados', doc.earnings, 'Total devengado', doc.grossTotal, color),
          amountTable('− Deducciones', doc.deductions, 'Total deducido', doc.deductionsTotal, color),
        ],
        columnGap: 16,
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'NETO A PAGAR', bold: true, color: '#ffffff', fontSize: 12 },
              { text: formatCop(doc.net), bold: true, color: '#ffffff', fontSize: 12, alignment: 'right' },
            ],
          ],
        },
        layout: {
          fillColor: () => color,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 14, 0, 4],
      },
      { text: `Son: ${doc.netInWords}`, style: 'muted' },
      { text: `Depositado en cuenta: ${bank}`, margin: [0, 6, 0, 0] },
      ...(doc.employerContributions.length
        ? [
            {
              text: `Aportes del empleador (informativo): ${doc.employerContributions
                .map((line) => `${line.label} ${formatCop(line.amount)}`)
                .join(' · ')}`,
              style: 'muted',
              margin: [0, 6, 0, 0],
            },
          ]
        : []),
    ],
  });
};

/** pdfmake definition of an employment certificate (legacy `print_cert.php` / `certificado_laboral.php`). */
export const employmentCertificateDefinition = (
  c: EmploymentCertificateContent,
  branding: DocumentBranding,
  qr: string,
): PdfDocumentDefinition => {
  const tenure = c.currentlyEmployed
    ? `labora en esta institución desde el ${longDate(c.hireDate)}`
    : `laboró en esta institución desde el ${longDate(c.hireDate)} hasta el ${longDate(c.retirementDate)}`;
  const strong = (text: string) => ({ text, bold: true });
  const paragraphs: PdfContent[] = [
    {
      text: [
        'Que ',
        strong(c.employeeName),
        `, identificado(a) con ${c.documentLabel} No. `,
        strong(c.documentNumber),
        `, ${tenure}, desempeñando el cargo de `,
        strong(c.position ?? '—'),
        ...(c.department ? [', adscrito(a) al área de ', strong(c.department)] : []),
        `, vinculado(a) mediante contrato a ${c.contractLabel}.`,
      ],
      style: 'paragraph',
    },
  ];
  if (c.salary !== null) {
    paragraphs.push({
      text: [
        `${c.currentlyEmployed ? 'Devenga' : 'Devengaba'} un salario mensual básico de `,
        strong(formatCop(c.salary)),
        ` (${c.salaryInWords ?? ''}).`,
      ],
      style: 'paragraph',
    });
  }
  paragraphs.push({
    text: `La presente certificación se expide a solicitud del interesado(a)${
      c.institution.city ? ` en ${c.institution.city}` : ''
    }, el ${longDate(c.issuedOn)}.`,
    style: 'paragraph',
  });
  return institutionalDocument({
    branding,
    institution: letterhead(c.institution),
    title: 'Certificado laboral',
    verification: { code: c.verificationCode, qr },
    content: [
      ...(c.addressee ? [{ text: ['Señores\n', strong(c.addressee)], margin: [0, 6, 0, 16] }] : []),
      { text: ['El suscrito representante legal de ', strong(c.institution.name)], margin: [0, 10, 0, 6] },
      {
        text: 'CERTIFICA',
        style: 'documentTitle',
        alignment: 'center',
        margin: [0, 6, 0, 14],
        color: branding.primaryColor,
      },
      ...paragraphs,
      signatures([{ name: c.institution.rectorName ?? 'Representante legal', role: 'Representante legal' }]),
    ],
  });
};

/** pdfmake definition of the yearly income and withholding summary. */
export const incomeCertificateDefinition = (
  doc: IncomeCertificateDocument,
  branding: DocumentBranding,
): PdfDocumentDefinition => {
  const c = doc.certificate;
  const rows: [string, number][] = [
    ['Pagos laborales (total devengado)', c.grossPayments],
    ['Aportes obligatorios a salud', c.mandatoryContributions.health],
    ['Aportes obligatorios a pensión', c.mandatoryContributions.pension],
    ['Fondo de solidaridad pensional', c.mandatoryContributions.solidarityFund],
    ['Total aportes obligatorios', c.mandatoryContributions.total],
    ['Retención en la fuente', c.withholding],
    ['Neto pagado', c.netPaid],
  ];
  return institutionalDocument({
    branding,
    institution: letterhead(doc.institution),
    title: 'Certificado de ingresos y retenciones',
    subtitle: `Año gravable ${c.year}`,
    content: [
      {
        table: {
          widths: ['auto', '*'],
          body: [
            [{ text: 'Empleado', bold: true }, c.employee.fullName],
            [{ text: 'Documento', bold: true }, c.employee.document],
            [{ text: 'Pagos de nómina incluidos', bold: true }, String(c.payments)],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 12],
      },
      dataTable(
        [{ header: 'Concepto' }, { header: 'Valor', align: 'right', width: 'auto' }],
        rows.map(([label, amount]) => [label, formatCop(amount)]),
        { color: branding.primaryColor, emphasize: ([label]) => label === 'Neto pagado' },
      ),
      { text: c.note, style: 'muted', margin: [0, 10, 0, 0] },
      {
        text: `Expedido${doc.institution.city ? ` en ${doc.institution.city}` : ''} el ${longDate(doc.issuedOn)}.`,
        margin: [0, 10, 0, 0],
      },
      signatures([{ name: doc.institution.rectorName ?? 'Representante legal', role: 'Representante legal' }]),
    ],
  });
};

/**
 * PDF renderer (pdfmake, no browser) for payslips, employment and income
 * certificates, with the school letterhead and, for certificates, the
 * verification code and QR on every page. Replaces the HTML renderer that
 * relied on the browser's "print to PDF".
 */
@Injectable()
export class PdfDocumentRenderer implements DocumentRendererPort {
  constructor(private readonly branding: DocumentBrandingProvider) {}

  async payslip(doc: PayslipDocument): Promise<RenderedDocument> {
    const definition = payslipDefinition(doc, await this.branding.load());
    return {
      contentType: 'application/pdf',
      fileName: `Desprendible_${fileSafe(doc.employee.fullName)}_${fileSafe(doc.period.label)}.pdf`,
      body: await renderPdf(definition),
    };
  }

  async employmentCertificate(content: EmploymentCertificateContent): Promise<RenderedDocument> {
    const qr = this.branding.verificationTarget('laboral', content.verificationCode);
    const definition = employmentCertificateDefinition(content, await this.branding.load(), qr);
    return {
      contentType: 'application/pdf',
      fileName: `Certificado_Laboral_${fileSafe(content.employeeName)}.pdf`,
      body: await renderPdf(definition),
    };
  }

  async incomeCertificate(document: IncomeCertificateDocument): Promise<RenderedDocument> {
    const definition = incomeCertificateDefinition(document, await this.branding.load());
    return {
      contentType: 'application/pdf',
      fileName: `Certificado_Ingresos_${document.certificate.year}_${fileSafe(document.certificate.employee.fullName)}.pdf`,
      body: await renderPdf(definition),
    };
  }
}
