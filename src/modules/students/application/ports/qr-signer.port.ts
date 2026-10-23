/** Signs and verifies the ID card QR payloads (HMAC with a server secret). */
export interface QrSignerPort {
  /** base64url signature of `message`. */
  sign(message: string): string;
  /** Constant-time verification of a signature produced by {@link sign}. */
  verify(message: string, signature: string): boolean;
}

export const QR_SIGNER = Symbol('QrSignerPort');
