import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

const DV_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * Check digit (DV) of a Colombian NIT, modulo 11 with the DIAN weights
 * (legacy `CufeCalculator::calculateDV`). Digits are weighted right to left.
 */
export function computeDv(nit: string): string {
  const digits = nit.replace(/\D/g, '');
  const sum = [...digits].reverse().reduce((acc, digit, index) => acc + Number(digit) * DV_WEIGHTS[index], 0);
  const remainder = sum % 11;
  return String(remainder >= 2 ? 11 - remainder : remainder);
}

/** A NIT without check digit, digits only (5–15). */
export function normalizeNit(raw: string, field = 'NIT'): string {
  const nit = (raw ?? '').replace(/[\s.]/g, '').split('-')[0];
  if (!/^\d{5,15}$/.test(nit)) {
    throw new BusinessRuleViolationError(
      `El ${field} debe tener entre 5 y 15 dígitos, sin dígito de verificación.`,
      'INVALID_NIT',
      {
        field,
      },
    );
  }
  return nit;
}
