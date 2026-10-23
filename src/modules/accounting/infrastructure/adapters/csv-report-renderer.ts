import { Injectable } from '@nestjs/common';
import type { RenderedReport, ReportTable } from '../../application/ports/report-renderer.port.js';
import type { ReportFileRenderer } from './report-file-renderer.js';

const UTF8_BOM = '﻿';

const escapeCell = (value: string | number | null): string => {
  if (value === null) return '';
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  // Neutralize spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value !== 'number' ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Renders reports as CSV (RFC 4180, UTF-8 with BOM so spreadsheets keep accents). */
@Injectable()
export class CsvReportRenderer implements ReportFileRenderer {
  async render(table: ReportTable): Promise<RenderedReport> {
    const lines = [[table.title], table.columns, ...table.rows].map((row) => row.map(escapeCell).join(','));
    return {
      fileName: `${table.slug}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: Buffer.from(UTF8_BOM + lines.join('\r\n') + '\r\n', 'utf8'),
    };
  }
}
