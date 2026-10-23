import type { DocumentBranding } from './document-branding.js';
import type { PdfContent, PdfDocumentDefinition } from './pdf-document.js';

/** School identification printed in the header (taken from each document's own data). */
export interface LetterheadInstitution {
  name: string;
  /** Already formatted, e.g. `900123456-7`. */
  nit: string | null;
  /** Extra lines (address, city…); merged with the branding contact data. */
  details?: (string | null | undefined)[];
}

export interface InstitutionalDocumentInput {
  branding: DocumentBranding;
  institution: LetterheadInstitution;
  title: string;
  subtitle?: string;
  content: PdfContent[];
  /** Verification code (+ QR content) printed in the footer of every page. */
  verification?: { code: string; qr: string };
  orientation?: 'portrait' | 'landscape';
  /** Free text printed at the bottom left of every page. */
  footerNote?: string;
}

export interface TableColumn {
  header: string;
  /** pdfmake width: number (pt), `'*'` or `'auto'`. */
  width?: number | '*' | 'auto';
  align?: 'left' | 'right' | 'center';
}

const MUTED = '#6b7280';
const RULE = '#d1d5db';
const ZEBRA = '#f3f4f6';

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `1500000` → `$ 1.500.000`. */
export const formatCop = (amount: number): string => cop.format(amount);
/** `1500.5` → `1.500,50`. */
export const formatDecimal = (amount: number): string => decimal.format(amount);

const header = ({ branding, institution, title, subtitle }: InstitutionalDocumentInput): PdfContent => {
  const details = [...(institution.details ?? []), ...branding.contact]
    .map((value) => value?.trim())
    .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  const identity: PdfContent[] = [
    { text: institution.name, style: 'schoolName', color: branding.primaryColor },
    ...(institution.nit ? [{ text: `NIT ${institution.nit}`, style: 'muted' }] : []),
    ...(details.length ? [{ text: details.join(' · '), style: 'muted' }] : []),
  ];
  return [
    {
      columns: [
        ...(branding.logo ? [{ image: 'logo', fit: [56, 56], width: 64 }] : []),
        { stack: identity, width: '*' },
        {
          stack: [
            { text: title, style: 'documentTitle', color: branding.primaryColor },
            ...(subtitle ? [{ text: subtitle, style: 'muted', alignment: 'right' }] : []),
          ],
          width: 'auto',
          alignment: 'right',
        },
      ],
      columnGap: 10,
    },
    {
      canvas: [{ type: 'line', x1: 0, y1: 4, x2: 2000, y2: 4, lineWidth: 2, lineColor: branding.primaryColor }],
      margin: [0, 2, 0, 12],
    },
  ];
};

const footer =
  ({ verification, footerNote, institution }: InstitutionalDocumentInput) =>
  (currentPage: number, pageCount: number): PdfContent => ({
    margin: [40, 0, 40, 0],
    columns: [
      {
        width: '*',
        stack: [
          ...(verification
            ? [
                {
                  text: [
                    'Código de verificación: ',
                    { text: verification.code, bold: true },
                    '. Verifique la autenticidad de este documento con la institución.',
                  ],
                  style: 'footer',
                },
              ]
            : []),
          { text: footerNote ?? `${institution.name} · Generado por Apreu`, style: 'footer' },
        ],
      },
      ...(verification ? [{ qr: verification.qr, fit: 52, width: 56 }] : []),
      { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', width: 70, alignment: 'right' },
    ],
    columnGap: 8,
  });

/**
 * Letter-size institutional document: header with logo, school name, NIT and
 * contact data in the school color; footer on every page with the
 * verification code + QR (when given) and page numbers.
 */
export const institutionalDocument = (input: InstitutionalDocumentInput): PdfDocumentDefinition => ({
  info: { title: input.title, author: input.institution.name, creator: 'Apreu' },
  pageSize: 'LETTER',
  pageOrientation: input.orientation ?? 'portrait',
  pageMargins: [40, 36, 40, input.verification ? 76 : 48],
  footer: footer(input),
  content: [header(input), ...input.content],
  images: input.branding.logo ? { logo: input.branding.logo } : undefined,
  defaultStyle: { fontSize: 9.5, color: '#1f2937', lineHeight: 1.15 },
  styles: {
    schoolName: { fontSize: 14, bold: true },
    documentTitle: { fontSize: 12, bold: true },
    muted: { fontSize: 8, color: MUTED },
    footer: { fontSize: 7, color: MUTED },
    sectionTitle: { fontSize: 10.5, bold: true, margin: [0, 10, 0, 4] },
    tableHeader: { bold: true, color: '#ffffff', fontSize: 8.5 },
    paragraph: { fontSize: 10.5, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 10] },
  },
});

/**
 * Data table with a colored header row repeated on each page, zebra rows and
 * thin horizontal rules. `emphasize` marks rows (e.g. totals) in bold.
 */
export const dataTable = (
  columns: TableColumn[],
  rows: (string | number | null)[][],
  options: {
    color: string;
    emphasize?: (row: (string | number | null)[], index: number) => boolean;
    fontSize?: number;
  },
): PdfContent => ({
  table: {
    headerRows: 1,
    widths: columns.map((column) => column.width ?? '*'),
    body: [
      columns.map((column) => ({
        text: column.header,
        style: 'tableHeader',
        fillColor: options.color,
        alignment: column.align ?? 'left',
      })),
      ...rows.map((row, index) =>
        row.map((cell, column) => ({
          text: cell === null ? '' : String(cell),
          alignment: columns[column]?.align ?? 'left',
          bold: options.emphasize?.(row, index) ?? false,
          fontSize: options.fontSize,
        })),
      ),
    ],
  },
  layout: {
    hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
    vLineWidth: () => 0,
    hLineColor: () => RULE,
    fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0 ? ZEBRA : null),
    paddingTop: () => 3,
    paddingBottom: () => 3,
  },
});

/** Signature line(s) at the end of a document. */
export const signatures = (labels: { name: string; role: string }[]): PdfContent => ({
  columns: labels.map(({ name, role }) => ({
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.8 }] },
      { text: name, bold: true, margin: [0, 4, 0, 0] },
      { text: role, style: 'muted' },
    ],
  })),
  margin: [0, 48, 0, 0],
  unbreakable: true,
});
