export const REPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/** Tabular representation of a report, independent of the output format. */
export interface ReportTable {
  title: string;
  /** Slug used for the file name, e.g. `balance-de-prueba`. */
  slug: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export interface RenderedReport {
  fileName: string;
  contentType: string;
  content: Buffer;
}

/** Renders report tables to downloadable files. */
export interface ReportRendererPort {
  render(table: ReportTable, format: ReportFormat): Promise<RenderedReport>;
}

export const REPORT_RENDERER = Symbol('ReportRendererPort');
