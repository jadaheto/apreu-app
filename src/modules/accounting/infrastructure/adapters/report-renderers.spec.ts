import ExcelJS from 'exceljs';
import type { DocumentBrandingProvider } from '../../../../shared/infrastructure/documents/document-branding.js';
import { FixedClock } from '../../../../shared/testing/fakes.js';
import type { ReportTable } from '../../application/ports/report-renderer.port.js';
import { CsvReportRenderer } from './csv-report-renderer.js';
import { MultiFormatReportRenderer } from './multi-format-report-renderer.js';
import { PdfReportRenderer } from './pdf-report-renderer.js';
import { isNumericColumn, isSummaryRow } from './report-file-renderer.js';
import { XlsxReportRenderer } from './xlsx-report-renderer.js';

const table: ReportTable = {
  title: 'Balance de prueba 2026-03-01 a 2026-03-31',
  slug: 'balance-de-prueba-2026-03-01_2026-03-31',
  columns: ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo débito', 'Saldo crédito'],
  rows: [
    ['110505', 'Caja General', 0, 1500000.5, 0, 1500000.5, 0],
    ['413501', '=cmd()', 0, 0, 1500000.5, 0, 1500000.5],
    [null, 'TOTALES', null, 1500000.5, 1500000.5, 1500000.5, 1500000.5],
  ],
};

const branding = {
  load: vi.fn().mockResolvedValue({
    institutionName: 'Colegio Demo',
    nit: '900123456-1',
    logo: null,
    primaryColor: '#123456',
    contact: ['Calle 1'],
  }),
} as unknown as DocumentBrandingProvider;

describe('report file helpers', () => {
  it('detects amount columns and summary rows', () => {
    expect(table.columns.map((_, i) => isNumericColumn(table, i))).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(table.rows.map(isSummaryRow)).toEqual([false, false, true]);
  });
});

describe('XlsxReportRenderer', () => {
  it('writes a sheet with the title, the expected columns and numeric amounts', async () => {
    const file = await new XlsxReportRenderer().render(table);
    expect(file).toMatchObject({
      fileName: `${table.slug}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(file.content.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.content as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('Balance de prueba 2026-03-01 a ');
    expect(sheet.getCell('A1').value).toBe(table.title);
    expect((sheet.getRow(2).values as unknown[]).slice(1)).toEqual(table.columns);
    expect(sheet.getCell('D3').value).toBe(1500000.5);
    expect(sheet.getColumn(4).numFmt).toContain('#,##0.00');
    expect(sheet.getCell('B4').value).toBe("'=cmd()");
    expect(sheet.getRow(5).font?.bold).toBe(true);
    expect(sheet.rowCount).toBe(5);
  });
});

describe('PdfReportRenderer', () => {
  it('renders a branded PDF', async () => {
    const file = await new PdfReportRenderer(branding, new FixedClock()).render(table);
    expect(file).toMatchObject({ fileName: `${table.slug}.pdf`, contentType: 'application/pdf' });
    expect(file.content.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(branding.load).toHaveBeenCalled();
  });
});

describe('MultiFormatReportRenderer', () => {
  it('dispatches each format to its renderer', async () => {
    const renderer = new MultiFormatReportRenderer(
      new CsvReportRenderer(),
      new XlsxReportRenderer(),
      new PdfReportRenderer(branding, new FixedClock()),
    );
    await expect(renderer.render(table, 'csv')).resolves.toMatchObject({ contentType: 'text/csv; charset=utf-8' });
    await expect(renderer.render(table, 'xlsx')).resolves.toMatchObject({ fileName: `${table.slug}.xlsx` });
    await expect(renderer.render(table, 'pdf')).resolves.toMatchObject({ contentType: 'application/pdf' });
  });
});
