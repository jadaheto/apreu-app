/** Verifies Meta's `X-Hub-Signature-256` header (HMAC-SHA256 of the raw body with the app secret). */
export interface WebhookSignaturePort {
  isValid(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean;
}

export const WEBHOOK_SIGNATURE = Symbol('WebhookSignaturePort');
