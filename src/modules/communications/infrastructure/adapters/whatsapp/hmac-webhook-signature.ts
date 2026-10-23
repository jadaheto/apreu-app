import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSignaturePort } from '../../../application/ports/webhook-signature.port.js';

/** Validates `X-Hub-Signature-256: sha256=<hex>` in constant time. */
export class HmacWebhookSignature implements WebhookSignaturePort {
  isValid(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
    const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader?.trim() ?? '');
    if (!match) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    return timingSafeEqual(expected, Buffer.from(match[1], 'hex'));
  }
}
