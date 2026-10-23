import { dataTable, formatCop, formatDecimal, institutionalDocument, signatures } from './institutional-layout.js';
import { renderPdf } from './pdf-document.js';

// 1×1 transparent PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('institutional layout', () => {
  it('builds a header with logo, NIT and contact data, and a verification footer', async () => {
    const definition = institutionalDocument({
      branding: {
        institutionName: null,
        nit: null,
        logo: PNG,
        primaryColor: '#123456',
        contact: ['Calle 1', 'Sincelejo'],
      },
      institution: { name: 'Colegio Demo', nit: '900123-4', details: ['Calle 1'] },
      title: 'Certificado',
      content: [dataTable([{ header: 'A' }, { header: 'B', align: 'right' }], [['x', 1]], { color: '#123456' })],
      verification: { code: 'ABCD-1234', qr: 'https://apreu.co/v/ABCD-1234' },
    });
    expect(definition.images).toEqual({ logo: PNG });
    const header = JSON.stringify(definition.content);
    expect(header).toContain('NIT 900123-4');
    expect(header).toContain('Calle 1 · Sincelejo');
    const footer = JSON.stringify((definition.footer as (a: number, b: number) => unknown)(1, 2));
    expect(footer).toContain('ABCD-1234');
    expect(footer).toContain('Página 1 de 2');
    expect(footer).toContain('"qr":"https://apreu.co/v/ABCD-1234"');

    const pdf = await renderPdf(definition);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('omits the logo and the QR when not available', () => {
    const definition = institutionalDocument({
      branding: { institutionName: null, nit: null, logo: null, primaryColor: '#123456', contact: [] },
      institution: { name: 'Colegio Demo', nit: null },
      title: 'Reporte',
      content: [signatures([{ name: 'Rector', role: 'Rectoría' }])],
    });
    expect(definition.images).toBeUndefined();
    expect(JSON.stringify(definition.content)).not.toContain('NIT');
    expect(JSON.stringify((definition.footer as (a: number, b: number) => unknown)(1, 1))).not.toContain('qr');
  });

  it('formats money and decimals the Colombian way', () => {
    expect(formatCop(1500000).replace(/\s/g, ' ')).toBe('$ 1.500.000');
    expect(formatDecimal(1500.5)).toBe('1.500,50');
  });
});
