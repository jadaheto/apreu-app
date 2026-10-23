import { createHmac } from 'node:crypto';
import type { Environment } from '../../../../../shared/infrastructure/config/environment.js';
import { HmacStudentQrVerifier } from './hmac-student-qr.verifier.js';

describe('HmacStudentQrVerifier', () => {
  const env = (studentQrSecret: string | null = null) =>
    ({ jwt: { secret: 'jwt-secret', expiresIn: '8h' }, studentQrSecret }) as Environment;
  const content = 'APREU1|colegio-a|15|2026';
  const sign = (key: string | Buffer) => createHmac('sha256', key).update(content).digest('base64url');
  it('uses STUDENT_QR_SECRET when configured', () => {
    const verifier = new HmacStudentQrVerifier(env('dedicated'));
    expect(verifier.isAuthentic(content, sign('dedicated'))).toBe(true);
    expect(verifier.isAuthentic(content, sign('otra'))).toBe(false);
  });

  it('derives the key from the JWT secret otherwise (same rule as the students context)', () => {
    const derived = createHmac('sha256', 'jwt-secret').update('apreu:student-id-card-qr').digest();
    const verifier = new HmacStudentQrVerifier(env());
    expect(verifier.isAuthentic(content, sign(derived))).toBe(true);
    expect(verifier.isAuthentic('APREU1|colegio-a|16|2026', sign(derived))).toBe(false);
    expect(verifier.isAuthentic(content, 'abc')).toBe(false);
  });
});
