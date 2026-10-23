import type { StudentQrVerifierPort } from '../application/ports/student-qr-verifier.port.js';

/** Deterministic fake signature: base64url of the signed content. */
const fakeSignature = (content: string): string => Buffer.from(content).toString('base64url');

export class FakeStudentQrVerifier implements StudentQrVerifierPort {
  isAuthentic(signedContent: string, signature: string): boolean {
    return signature === fakeSignature(signedContent);
  }
}

/** Builds a card QR accepted by {@link FakeStudentQrVerifier}. */
export const aSignedQr = (studentId: number, year = 2026, tenant = 'colegio-a'): string => {
  const content = `APREU1|${tenant}|${studentId}|${year}`;
  return `${content}|${fakeSignature(content)}`;
};
