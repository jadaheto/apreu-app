/** Verifies the HMAC signature of a student ID card QR. */
export interface StudentQrVerifierPort {
  isAuthentic(signedContent: string, signature: string): boolean;
}

export const STUDENT_QR_VERIFIER = Symbol('StudentQrVerifierPort');
