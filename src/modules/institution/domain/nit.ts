import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

const DIAN_PRIMES = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * DIAN check digit ("dígito de verificación") of a NIT: digits from right to
 * left multiplied by the DIAN primes, `mod = sum % 11`,
 * `dv = mod >= 2 ? 11 - mod : mod` (legacy `settings.php:859-870`).
 */
export const calculateNitDv = (digits: string): number => {
  if (!/^\d{1,15}$/.test(digits)) {
    throw new BusinessRuleViolationError(`NIT inválido: "${digits}".`, 'INVALID_NIT');
  }
  const sum = [...digits]
    .reverse()
    .reduce((acc, digit, index) => acc + Number(digit) * (DIAN_PRIMES[index] as number), 0);
  const mod = sum % 11;
  return mod >= 2 ? 11 - mod : mod;
};

/** Identity document of the institution. */
export type InstitutionDocumentType = 'NIT' | 'CC';
export const INSTITUTION_DOCUMENT_TYPES: readonly InstitutionDocumentType[] = ['NIT', 'CC'];

interface NitValue {
  number: string;
  dv: number | null;
}

/**
 * Tax identification number. For `NIT` the check digit is always calculated
 * (in the legacy "Empresa/RUT" tab it was typed by hand and could be wrong);
 * when the input includes it (`900.123.456-8`) it must match. A `CC` has no
 * check digit.
 */
export class Nit extends ValueObject<NitValue> {
  private constructor(value: NitValue) {
    super(value);
  }

  static create(raw: string, documentType: InstitutionDocumentType = 'NIT'): Nit {
    const cleaned = (raw ?? '').replace(/[.\s]/g, '');
    const [digits = '', typedDv, ...rest] = cleaned.split('-');
    const [min, max] = documentType === 'NIT' ? [5, 15] : [5, 12];
    if (
      rest.length ||
      !new RegExp(`^\\d{${min},${max}}$`).test(digits) ||
      (typedDv !== undefined && !/^\d$/.test(typedDv))
    ) {
      throw new BusinessRuleViolationError(`Número de identificación inválido: "${raw}".`, 'INVALID_NIT');
    }
    if (documentType === 'CC') {
      if (typedDv !== undefined)
        throw new BusinessRuleViolationError('Una cédula no lleva dígito de verificación.', 'INVALID_NIT');
      return new Nit({ number: digits, dv: null });
    }
    const dv = calculateNitDv(digits);
    if (typedDv !== undefined && Number(typedDv) !== dv) {
      throw new BusinessRuleViolationError(
        `El dígito de verificación del NIT ${digits} es ${dv}, no ${typedDv}.`,
        'INVALID_NIT_DV',
        {
          expected: dv,
        },
      );
    }
    return new Nit({ number: digits, dv });
  }

  /** Rebuilds a stored value without validation (legacy data may be malformed). */
  static restore(number: string, dv: number | null): Nit {
    return new Nit({ number, dv });
  }

  get number(): string {
    return this.value.number;
  }

  get dv(): number | null {
    return this.value.dv;
  }

  /** `900123456-8`, or the bare number when there is no check digit. */
  format(): string {
    return this.value.dv === null ? this.value.number : `${this.value.number}-${this.value.dv}`;
  }
}
