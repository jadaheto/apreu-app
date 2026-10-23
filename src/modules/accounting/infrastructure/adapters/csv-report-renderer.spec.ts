import { CsvReportRenderer } from './csv-report-renderer.js';

describe('CsvReportRenderer', () => {
  const table = {
    title: 'Balance de prueba',
    slug: 'balance',
    columns: ['Código', 'Cuenta', 'Saldo'],
    rows: [
      ['110505', 'Caja, "general"', 1500.5],
      [null, '=HYPERLINK("x")', -2],
    ],
  };

  it('renders RFC 4180 CSV with BOM, quoting and formula neutralization', async () => {
    const file = await new CsvReportRenderer().render(table);
    expect(file).toMatchObject({ fileName: 'balance.csv', contentType: 'text/csv; charset=utf-8' });
    expect(file.content.toString('utf8')).toBe(
      '﻿Balance de prueba\r\nCódigo,Cuenta,Saldo\r\n110505,"Caja, ""general""",1500.50\r\n,"\'=HYPERLINK(""x"")",-2.00\r\n',
    );
  });
});
