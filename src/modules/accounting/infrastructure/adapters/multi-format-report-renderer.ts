import { Injectable } from '@nestjs/common';
import type {
  RenderedReport,
  ReportFormat,
  ReportRendererPort,
  ReportTable,
} from '../../application/ports/report-renderer.port.js';
import { CsvReportRenderer } from './csv-report-renderer.js';
import { PdfReportRenderer } from './pdf-report-renderer.js';
import type { ReportFileRenderer } from './report-file-renderer.js';
import { XlsxReportRenderer } from './xlsx-report-renderer.js';

/** {@link ReportRendererPort} adapter dispatching each format to its renderer (CSV, XLSX, PDF). */
@Injectable()
export class MultiFormatReportRenderer implements ReportRendererPort {
  private readonly renderers: Record<ReportFormat, ReportFileRenderer>;

  constructor(csv: CsvReportRenderer, xlsx: XlsxReportRenderer, pdf: PdfReportRenderer) {
    this.renderers = { csv, xlsx, pdf };
  }

  render(table: ReportTable, format: ReportFormat): Promise<RenderedReport> {
    return this.renderers[format].render(table);
  }
}
