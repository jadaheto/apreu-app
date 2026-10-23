/** Cryptographically secure random secrets. */
export interface SecretGeneratorPort {
  /**
   * Temporary portal password (≥ 12 characters, letters and digits). Replaces
   * the predictable legacy password `apreu` + last 4 document digits (S5).
   */
  temporaryPassword(): string;
  /** Opaque, URL-safe code to verify an issued certificate. */
  verificationCode(): string;
}

export const SECRET_GENERATOR = Symbol('SecretGeneratorPort');
