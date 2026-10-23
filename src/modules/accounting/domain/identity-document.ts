import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

export const DOCUMENT_TYPES = ['NIT', 'CC', 'CE', 'TI', 'Pasaporte'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** DIAN weights for the NIT check digit, applied from the rightmost digit. */
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const NUMERIC_TYPES: readonly DocumentType[] = ['NIT', 'CC', 'TI'];

/** Check digit (DV) of a NIT using the DIAN modulo-11 algorithm. */
export const nitCheckDigit = (nit: string): string => {
  const digits = nit.split('').reverse();
  const sum = digits.reduce((acc, digit, index) => acc + Number(digit) * NIT_WEIGHTS[index], 0);
  const remainder = sum % 11;
  return String(remainder > 1 ? 11 - remainder : remainder);
};

interface IdentityDocumentValue {
  type: DocumentType;
  number: string;
  dv: string | null;
}

/**
 * Identity document of a third party (RN-TP-01/02).
 *
 * - NIT, CC and TI are numeric (dots, dashes and spaces are removed).
 * - For NIT the check digit is computed (DIAN modulo 11) and, when supplied,
 *   must match. Other document types never carry a DV.
 */
export class IdentityDocument extends ValueObject<IdentityDocumentValue> {
  private constructor(value: IdentityDocumentValue) {
    super(value);
  }

  static create(type: DocumentType, rawNumber: string, dv?: string | null): IdentityDocument {
    Guard.oneOf(type, DOCUMENT_TYPES, 'tipo de documento');
    const number = NUMERIC_TYPES.includes(type)
      ? (rawNumber ?? '').replace(/[\s.-]/g, '')
      : (rawNumber ?? '').trim().toUpperCase();
    Guard.againstEmpty(number, 'número de documento');
    Guard.againstMaxLength(number, type === 'NIT' ? NIT_WEIGHTS.length : 50, 'número de documento');
    const pattern = NUMERIC_TYPES.includes(type) ? /^\d+$/ : /^[A-Z0-9]+$/;
    if (!pattern.test(number)) {
      throw new BusinessRuleViolationError(`Número de documento inválido para ${type}.`, 'INVALID_DOCUMENT_NUMBER');
    }
    if (type !== 'NIT') return new IdentityDocument({ type, number, dv: null });

    const expected = nitCheckDigit(number);
    const given = dv?.trim();
    if (given && given !== expected) {
      throw new BusinessRuleViolationError(
        `El dígito de verificación del NIT ${number} debe ser ${expected}.`,
        'INVALID_NIT_CHECK_DIGIT',
        { expected },
      );
    }
    return new IdentityDocument({ type, number, dv: expected });
  }

  /** Rebuilds a stored document without validation (legacy rows were never validated). */
  static fromPersistence(type: DocumentType, number: string, dv: string | null): IdentityDocument {
    return new IdentityDocument({ type, number, dv });
  }

  get type(): DocumentType {
    return this.value.type;
  }
  get number(): string {
    return this.value.number;
  }
  get dv(): string | null {
    return this.value.dv;
  }

  /** e.g. `900123456-7` or `1020304050`. */
  toString(): string {
    return this.value.dv ? `${this.value.number}-${this.value.dv}` : this.value.number;
  }
}
