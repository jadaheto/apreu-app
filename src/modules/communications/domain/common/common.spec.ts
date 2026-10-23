import { BillingMonth } from './billing-month.js';
import { assertDeliveryPolicy } from './delivery-policy.js';
import { detectFileType } from './file-signature.js';
import { assertDay, bogotaDay, formatCop, formatDay } from './format.js';
import { escapeHtml, hasLineBreak, htmlToPlainText, truncate } from './text.js';
import { PDF_BYTES, PNG_BYTES } from '../../testing/fakes.js';

describe('text helpers', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<b a="1">'&`)).toBe('&lt;b a=&quot;1&quot;&gt;&#39;&amp;');
    expect(escapeHtml(null)).toBe('');
  });

  it('converts HTML to collapsed plain text dropping scripts and decoding entities', () => {
    const html = '<p>Hola&nbsp;<b>padres</b></p><script>alert(1)</script><div>Reunión &amp; más &#241;</div>';
    expect(htmlToPlainText(html)).toBe('Hola padres\nReunión & más ñ');
  });

  it('truncates by characters and detects line breaks', () => {
    expect(truncate('abcdef', 3)).toBe('abc');
    expect(truncate(null, 3)).toBe('');
    expect(hasLineBreak('a\r\nBcc: x')).toBe(true);
    expect(hasLineBreak('asunto')).toBe(false);
  });
});

describe('format helpers', () => {
  it('formats pesos like the legacy UI', () => {
    expect(formatCop(850000)).toBe('$850.000');
    expect(formatCop(1250000.4)).toBe('$1.250.000');
    expect(formatCop(0)).toBe('$0');
  });

  it('formats and validates calendar days', () => {
    expect(formatDay('2026-03-01')).toBe('01/03/2026');
    expect(() => formatDay('01/03/2026')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
    expect(() => assertDay('2026-02-30', 'fecha')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
    expect(() => assertDay('2026-02-28', 'fecha')).not.toThrow();
  });

  it('computes the day in Bogotá', () => {
    expect(bogotaDay(new Date('2026-03-16T03:00:00Z'))).toBe('2026-03-15');
  });
});

describe('BillingMonth', () => {
  it.each([
    ['2026-02', '2026-02-28'],
    ['2024-02', '2024-02-29'],
    ['2026-04', '2026-04-30'],
    ['2026-12', '2026-12-31'],
  ])('uses the real last day of %s (legacy bug #15)', (month, last) => {
    const billing = BillingMonth.create(month);
    expect(billing.firstDay).toBe(`${month}-01`);
    expect(billing.lastDay).toBe(last);
  });

  it.each(['2026-13', '2026-1', 'marzo'])('rejects %s', (month) => {
    expect(() => BillingMonth.create(month)).toThrow(expect.objectContaining({ code: 'INVALID_MONTH' }));
  });
});

describe('detectFileType', () => {
  it('recognizes signatures and ignores names', () => {
    expect(detectFileType(PNG_BYTES)).toBe('png');
    expect(detectFileType(PDF_BYTES)).toBe('pdf');
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectFileType(Buffer.from('GIF89a...'))).toBe('gif');
    expect(detectFileType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(detectFileType(Buffer.from('PK\x03\x04'))).toBe('zip');
    expect(detectFileType(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe('ole');
    expect(detectFileType(Buffer.from('<?php system($_GET["c"]); ?>'))).toBeNull();
    expect(detectFileType(Buffer.from('<svg onload="alert(1)"/>'))).toBeNull();
  });
});

describe('assertDeliveryPolicy', () => {
  it('accepts sane values and rejects extremes', () => {
    expect(() => assertDeliveryPolicy({ batchSize: 10, pauseMs: 1000 })).not.toThrow();
    expect(() => assertDeliveryPolicy({ batchSize: 0, pauseMs: 1000 })).toThrow();
    expect(() => assertDeliveryPolicy({ batchSize: 10, pauseMs: 120_000 })).toThrow();
  });
});
