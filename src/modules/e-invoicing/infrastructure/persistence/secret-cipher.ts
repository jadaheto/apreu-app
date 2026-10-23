import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ExternalServiceError } from '../../../../shared/domain/domain-error.js';

const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption of DIAN secrets at rest (software PIN, technical
 * keys), with the key outside the database (env `E_INVOICING_SECRET_KEY`,
 * 32 bytes in base64). Values without the `enc:v1:` prefix are legacy
 * plaintext and are read as-is; they are encrypted on the next save.
 */
export class SecretCipher {
  private constructor(private readonly key: Buffer | null) {}

  /** @param base64Key `E_INVOICING_SECRET_KEY`; `undefined`/empty disables writing secrets. */
  static fromBase64(base64Key: string | undefined): SecretCipher {
    if (!base64Key?.trim()) return new SecretCipher(null);
    const key = Buffer.from(base64Key.trim(), 'base64');
    if (key.length !== 32) throw new Error('E_INVOICING_SECRET_KEY debe ser una clave de 32 bytes en base64.');
    return new SecretCipher(key);
  }

  encrypt(plain: string): string {
    if (!this.key) {
      throw new ExternalServiceError(
        'Cifrado',
        'configure E_INVOICING_SECRET_KEY para guardar secretos de facturación electrónica.',
      );
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(stored: string): string {
    if (!stored.startsWith(PREFIX)) return stored;
    if (!this.key)
      throw new ExternalServiceError('Cifrado', 'falta E_INVOICING_SECRET_KEY para leer secretos cifrados.');
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, IV_LENGTH));
    decipher.setAuthTag(raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString('utf8');
  }
}

export const SECRET_CIPHER = Symbol('SecretCipher');
