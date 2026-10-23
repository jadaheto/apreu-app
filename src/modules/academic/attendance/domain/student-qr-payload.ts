import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

export const STUDENT_QR_VERSION = 'APREU1';

/**
 * Content of the student ID card QR issued by the students context:
 * `APREU1|{tenantSlug}|{studentId}|{academicYear}|{signature}` where the
 * signature is `base64url(HMAC-SHA256(secret, "APREU1|tenant|studentId|year"))`.
 *
 * Replaces the legacy unsigned `{year}{document}{level}{type}` payload, which
 * anyone could forge knowing a document number (S13) and was matched by SQL
 * prefix (B29). The legacy format is no longer accepted.
 */
export class StudentQrPayload {
  private constructor(
    readonly tenant: string,
    readonly studentId: number,
    readonly academicYear: number,
    readonly signature: string,
  ) {}

  static parse(raw: string): StudentQrPayload {
    const parts = (raw ?? '').trim().split('|');
    const [version, tenant, studentId, year, signature] = parts;
    const valid =
      parts.length === 5 &&
      version === STUDENT_QR_VERSION &&
      /^[a-z0-9-]{1,60}$/.test(tenant) &&
      /^[1-9]\d{0,9}$/.test(studentId) &&
      /^\d{4}$/.test(year) &&
      /^[A-Za-z0-9_-]{16,}$/.test(signature);
    if (!valid) throw new BusinessRuleViolationError('Código QR inválido o de un formato no soportado.', 'INVALID_QR');
    return new StudentQrPayload(tenant, Number(studentId), Number(year), signature);
  }

  /** The exact text covered by the signature. */
  get signedContent(): string {
    return `${STUDENT_QR_VERSION}|${this.tenant}|${this.studentId}|${this.academicYear}`;
  }
}
