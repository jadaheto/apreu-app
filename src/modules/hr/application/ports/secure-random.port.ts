/** Cryptographically secure random values. */
export interface SecureRandomPort {
  /**
   * Random temporary password (letters and digits). Replaces the predictable
   * legacy `apreu` + last 4 document digits (S-5).
   */
  temporaryPassword(): string;
  /** Random, unguessable verification code for issued documents. */
  verificationCode(): string;
}

export const SECURE_RANDOM = Symbol('SecureRandomPort');
