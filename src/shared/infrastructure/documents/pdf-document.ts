import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Minimal typing of the pdfmake document definition used by the PDF
 * adapters (pdfmake ships no TypeScript types). See
 * https://pdfmake.github.io/docs/ for the full format.
 */
export type PdfContent = string | PdfContent[] | { [property: string]: unknown };
export type PdfStyle = Record<string, unknown>;

export interface PdfDocumentDefinition {
  info?: { title?: string; author?: string; subject?: string; creator?: string };
  pageSize?: 'LETTER' | 'A4';
  pageOrientation?: 'portrait' | 'landscape';
  pageMargins?: [number, number, number, number];
  header?: PdfContent | ((currentPage: number, pageCount: number) => PdfContent);
  footer?: PdfContent | ((currentPage: number, pageCount: number) => PdfContent);
  content: PdfContent;
  styles?: Record<string, PdfStyle>;
  defaultStyle?: PdfStyle;
  /** Named images (data URLs) referenced by `{ image: '<name>' }`. */
  images?: Record<string, string>;
}

interface PdfMake {
  virtualfs: { writeFileSync(name: string, content: Buffer): void };
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(policy: (url: string) => boolean): void;
  setLocalAccessPolicy(policy: (path: string) => boolean): void;
  createPdf(definition: PdfDocumentDefinition): { getBuffer(): Promise<Buffer> };
}

const FONT_FILES = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italic.ttf',
  bolditalics: 'Roboto-MediumItalic.ttf',
};

let engine: PdfMake | null = null;

/**
 * pdfmake configured once per process: Roboto (full Unicode, accents, ñ)
 * embedded from the package through its virtual file system, and every
 * remote URL and local path denied, so documents only contain the data and
 * data-URL images the adapters pass in (no SSRF / file disclosure).
 */
const pdfMake = (): PdfMake => {
  if (engine) return engine;
  const require = createRequire(import.meta.url);
  const instance = require('pdfmake') as PdfMake;
  const fontsDir = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
  for (const file of Object.values(FONT_FILES)) {
    instance.virtualfs.writeFileSync(file, readFileSync(join(fontsDir, file)));
  }
  instance.setFonts({ Roboto: FONT_FILES });
  instance.setUrlAccessPolicy(() => false);
  instance.setLocalAccessPolicy(() => false);
  engine = instance;
  return instance;
};

/** Renders a pdfmake definition to PDF bytes (pure JS, no browser). */
export const renderPdf = (definition: PdfDocumentDefinition): Promise<Buffer> =>
  pdfMake()
    .createPdf({ pageSize: 'LETTER', ...definition, defaultStyle: { font: 'Roboto', ...definition.defaultStyle } })
    .getBuffer();
