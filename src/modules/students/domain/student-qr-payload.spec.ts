import { StudentQrPayload } from './student-qr-payload.js';

const SIGNATURE = 'q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU';

describe('StudentQrPayload', () => {
  it('formats the signed APREU1 payload', () => {
    const payload = StudentQrPayload.for('colegio-demo', 15, 2026);
    expect(payload.message).toBe('APREU1|colegio-demo|15|2026');
    expect(payload.withSignature(SIGNATURE).toString()).toBe(`APREU1|colegio-demo|15|2026|${SIGNATURE}`);
    expect(() => payload.toString()).toThrow();
  });

  it('parses a scanned payload', () => {
    const parsed = StudentQrPayload.parse(` APREU1|colegio-demo|15|2026|${SIGNATURE} `);
    expect(parsed).toMatchObject({
      tenant: 'colegio-demo',
      studentId: 15,
      academicYear: 2026,
      signature: SIGNATURE,
    });
  });

  it.each([
    '20261101814264primariaT',
    `APREU2|colegio-demo|15|2026|${SIGNATURE}`,
    `APREU1|Colegio Demo|15|2026|${SIGNATURE}`,
    `APREU1|colegio-demo|0|2026|${SIGNATURE}`,
    `APREU1|colegio-demo|15|26|${SIGNATURE}`,
    'APREU1|colegio-demo|15|2026|corta',
    `APREU1|colegio-demo|15|2026|${SIGNATURE}|extra`,
    '',
  ])('rejects "%s" (legacy predictable QR, S13)', (raw) => {
    expect(() => StudentQrPayload.parse(raw)).toThrow(expect.objectContaining({ code: 'INVALID_QR' }));
  });

  it('rejects invalid data to sign', () => {
    expect(() => StudentQrPayload.for('BAD SLUG', 1, 2026)).toThrow(
      expect.objectContaining({ code: 'INVALID_QR_DATA' }),
    );
    expect(() => StudentQrPayload.for('ok', 0, 2026)).toThrow(expect.objectContaining({ code: 'INVALID_QR_DATA' }));
  });
});
