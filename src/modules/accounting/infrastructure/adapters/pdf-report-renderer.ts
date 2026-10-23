import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { DocumentBrandingProvider } from '../../../../shared/infrastructure/documents/document-branding.js';
import {
  dataTable,
  formatDecimal,
  institutionalDocument,
} from '../../../../shared/infrastructure/documents/institutional-layout.js';
import { renderPdf } from '../../../../shared/infrastructure/documents/pdf-document.js';
import type { RenderedReport, ReportTable } from '../../application/ports/report-renderer.port.js';
import { isNumericColumn, isSummaryRow, type ReportFileRenderer } from './report-file-renderer.js';

const DEFAULT_SCHOOL_NAME = 'Institución Educativa';
/** Wide reports (books with many columns) are printed in landscape. */
const LANDSCAPE_FROM_COLUMNS = 6;

/**
 * Renders reports as a branded PDF (the legacy only offered
 * `window.print()`): school letterhead, amounts right-aligned with Colombian
 * number format, summary rows in bold and page numbers.
 */
@Injectable()
export class PdfReportRenderer implements ReportFileRenderer {
  constructor(
    private readonly branding: DocumentBrandingProvider,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async render(table: ReportTable): Promise<RenderedReport> {
    const branding = await this.branding.load();
    const numeric = table.columns.map((_, index) => isNumericColumn(table, index));
    const landscape = table.columns.length >= LANDSCAPE_FROM_COLUMNS;
    const rows = table.rows.map((row) =>
      row.map((value, index) => (typeof value === 'number' && numeric[index] ? formatDecimal(value) : value)),
    );
    const definition = institutionalDocument({
      branding,
      institution: { name: branding.institutionName ?? DEFAULT_SCHOOL_NAME, nit: branding.nit },
      title: table.title,
      subtitle: `Generado el ${this.clock.now().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
      orientation: landscape ? 'landscape' : 'portrait',
      content: [
        dataTable(
          table.columns.map((header, index) => ({
            header,
            align: numeric[index] ? 'right' : 'left',
            width: numeric[index] ? 'auto' : '*',
          })),
          rows,
          { color: branding.primaryColor, emphasize: (_, index) => isSummaryRow(table.rows[index]), fontSize: 8 },
        ),
      ],
    });
    return { fileName: `${table.slug}.pdf`, contentType: 'application/pdf', content: await renderPdf(definition) };
  }
}
