import { randomBytes } from 'node:crypto';
import { SecretCipher } from './secret-cipher.js';

describe('SecretCipher', () => {
  const cipher = SecretCipher.fromBase64(randomBytes(32).toString('base64'));

  it('encrypts with AES-GCM (random IV) and decrypts', () => {
    const first = cipher.encrypt('clave-tecnica');
    expect(first).toMatch(/^enc:v1:/);
    expect(first).not.toBe(cipher.encrypt('clave-tecnica'));
    expect(cipher.decrypt(first)).toBe('clave-tecnica');
  });

  it('reads legacy plaintext values as-is', () => {
    expect(cipher.decrypt('12345')).toBe('12345');
  });

  it('detects tampering', () => {
    const value = cipher.encrypt('x');
    expect(() => cipher.decrypt(`${value.slice(0, -2)}AA`)).toThrow();
  });

  it('refuses to store secrets without a key and validates the key size', () => {
    expect(() => SecretCipher.fromBase64(undefined).encrypt('x')).toThrow(
      expect.objectContaining({ code: 'EXTERNAL_SERVICE_ERROR' }),
    );
    expect(() => SecretCipher.fromBase64(Buffer.from('corta').toString('base64'))).toThrow('32 bytes');
  });
});
