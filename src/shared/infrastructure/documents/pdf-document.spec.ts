import { renderPdf } from './pdf-document.js';

describe('renderPdf', () => {
  it('renders Unicode text, tables and QR codes to a PDF buffer', async () => {
    const pdf = await renderPdf({
      info: { title: 'Prueba' },
      content: [
        { text: 'Año lectivo — Peña Ñandú', bold: true },
        { table: { body: [['a', 'b']] } },
        { qr: 'https://apreu.co/v/ABCD', fit: 60 },
      ],
    });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.subarray(-6).toString('latin1')).toContain('%%EOF');
  });

  it('never fetches remote or local resources', async () => {
    await expect(renderPdf({ content: [{ image: 'https://example.com/x.png' }] })).rejects.toThrow();
    await expect(renderPdf({ content: [{ image: '/etc/passwd' }] })).rejects.toThrow();
  });
});
