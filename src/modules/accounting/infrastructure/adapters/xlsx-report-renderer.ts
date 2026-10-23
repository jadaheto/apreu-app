import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { RenderedReport, ReportTable } from '../../application/ports/report-renderer.port.js';
import { isNumericColumn, isSummaryRow, type ReportFileRenderer } from './report-file-renderer.js';

const AMOUNT_FORMAT = '#,##0.00;[Red]-#,##0.00';
const HEADER_FILL = 'FF47557C';
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;

/** Neutralizes formulas in text cells (same rule as the CSV export). */
const safeText = (value: string): string => (/^[=+\-@]/.test(value) ? `'${value}` : value);

/**
 * Renders reports as an Excel workbook: title row, bold colored header with
 * autofilter and frozen panes, amounts as real numbers with thousands
 * format (so they can be summed), summary rows in bold.
 */
@Injectable()
export class XlsxReportRenderer implements ReportFileRenderer {
  async render(table: ReportTable): Promise<RenderedReport> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Apreu';
    const sheet = workbook.addWorksheet(table.title.replace(INVALID_SHEET_CHARS, ' ').slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    const numeric = table.columns.map((_, index) => isNumericColumn(table, index));

    sheet.addRow([table.title]).font = { bold: true, size: 14 };
    sheet.mergeCells(1, 1, 1, Math.max(table.columns.length, 1));
    const header = sheet.addRow(table.columns);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: table.columns.length } };

    for (const values of table.rows) {
      const row = sheet.addRow(values.map((value) => (typeof value === 'string' ? safeText(value) : value)));
      if (isSummaryRow(values)) row.font = { bold: true };
    }

    table.columns.forEach((title, index) => {
      const column = sheet.getColumn(index + 1);
      if (numeric[index]) column.numFmt = AMOUNT_FORMAT;
      const longest = Math.max(title.length, ...table.rows.map((row) => String(row[index] ?? '').length));
      column.width = Math.min(Math.max(longest + 2, numeric[index] ? 14 : 10), 60);
    });

    return {
      fileName: `${table.slug}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
  }
}
