import type { RenderedReport, ReportTable } from '../../application/ports/report-renderer.port.js';

/** Renders a report table in one specific file format. */
export interface ReportFileRenderer {
  render(table: ReportTable): Promise<RenderedReport>;
}

/** Leftmost cells that mark a summary row (totals, closing balances, results), printed in bold. */
const SUMMARY_LABEL = /^(totales?|total\b|saldo (inicial|final)|utilidad)/i;

export const isSummaryRow = (row: ReportTable['rows'][number]): boolean =>
  row.some((cell) => typeof cell === 'string' && SUMMARY_LABEL.test(cell.trim()));

/** True when every non-empty value of the column is a number (amount column). */
export const isNumericColumn = (table: ReportTable, column: number): boolean => {
  const values = table.rows.map((row) => row[column]).filter((value) => value !== null && value !== '');
  return values.length > 0 && values.every((value) => typeof value === 'number');
};
