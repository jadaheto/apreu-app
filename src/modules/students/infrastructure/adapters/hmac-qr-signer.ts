import { createHmac, timingSafeEqual } from 'node:crypto';
import type { QrSignerPort } from '../../application/ports/qr-signer.port.js';

/** Environment variable with the dedicated QR signing secret (shared with the attendance reader). */

/**
 * HMAC-SHA256 signer of ID card QR payloads (base64url, 43 characters).
 * Uses `STUDENT_QR_SECRET`; when it is not set, a key is derived from the JWT
 * secret so the feature works out of the box without reusing the JWT key
 * directly.
 */
export class HmacQrSigner implements QrSignerPort {
  private constructor(private readonly key: Buffer) {}

  static create(dedicatedSecret: string | undefined, jwtSecret: string): HmacQrSigner {
    const key = dedicatedSecret?.trim()
      ? Buffer.from(dedicatedSecret.trim())
      : createHmac('sha256', jwtSecret).update('apreu:student-id-card-qr').digest();
    return new HmacQrSigner(key);
  }

  sign(message: string): string {
    return createHmac('sha256', this.key).update(message).digest('base64url');
  }

  verify(message: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(message));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}
