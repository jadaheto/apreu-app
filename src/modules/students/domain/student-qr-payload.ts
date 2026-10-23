import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

const VERSION = 'APREU1';
const SEPARATOR = '|';
const TENANT_PATTERN = /^[a-z0-9-]{1,60}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Signed content of the student ID card QR, in the format proposed by the
 * academic analysis (02 §R-QR, rule 34):
 *
 * `APREU1|{tenant}|{studentId}|{academicYear}|{signature}`
 *
 * `signature` = base64url(HMAC-SHA256(secret, "APREU1|{tenant}|{studentId}|{academicYear}")).
 *
 * The legacy QR (`{year}{document}{level}{docInitial}`) was predictable and
 * could be forged by anyone knowing a document number (security S9/S13).
 */
export class StudentQrPayload {
  private constructor(
    readonly tenant: string,
    readonly studentId: number,
    readonly academicYear: number,
    readonly signature: string | null,
  ) {}

  /** Unsigned payload; sign {@link message} and call {@link withSignature}. */
  static for(tenant: string, studentId: number, academicYear: number): StudentQrPayload {
    if (
      !TENANT_PATTERN.test(tenant) ||
      !Number.isInteger(studentId) ||
      studentId < 1 ||
      !Number.isInteger(academicYear)
    ) {
      throw new BusinessRuleViolationError('Datos inválidos para el código QR del carnet.', 'INVALID_QR_DATA');
    }
    return new StudentQrPayload(tenant, studentId, academicYear, null);
  }

  /** Parses a scanned QR. Throws `INVALID_QR` when the text is not a signed APREU1 payload. */
  static parse(raw: string): StudentQrPayload {
    const parts = (raw ?? '').trim().split(SEPARATOR);
    const [version, tenant, studentId, year, signature] = parts;
    const valid =
      parts.length === 5 &&
      version === VERSION &&
      TENANT_PATTERN.test(tenant) &&
      /^[1-9]\d{0,9}$/.test(studentId) &&
      /^\d{4}$/.test(year) &&
      SIGNATURE_PATTERN.test(signature);
    if (!valid) {
      throw new BusinessRuleViolationError('El código QR no es un carnet válido.', 'INVALID_QR');
    }
    return new StudentQrPayload(tenant, Number(studentId), Number(year), signature);
  }

  /** Text covered by the signature. */
  get message(): string {
    return [VERSION, this.tenant, this.studentId, this.academicYear].join(SEPARATOR);
  }

  withSignature(signature: string): StudentQrPayload {
    return new StudentQrPayload(this.tenant, this.studentId, this.academicYear, signature);
  }

  /** Full QR text. */
  toString(): string {
    if (!this.signature) throw new Error('El payload del QR no está firmado.');
    return `${this.message}${SEPARATOR}${this.signature}`;
  }
}
