import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

const PREFIX_PATTERN = /^[A-Z0-9]{1,10}$/;
const MAX_SEQUENCE = 999_999;

/**
 * Cash receipt number `{prefix}-{YYYY}-{NNNNNN}`, e.g. `REC-2026-000042`
 * (rule RN-12). The year is the one of the payment date (legacy used the
 * current year, bug B3) and the sequence restarts every year.
 */
export const ReceiptNumber = {
  normalizePrefix(raw: string | null | undefined): string {
    const prefix = (raw ?? '').trim().toUpperCase() || 'REC';
    if (!PREFIX_PATTERN.test(prefix)) {
      throw new BusinessRuleViolationError(
        `Prefijo de recibo inválido: "${raw}". Use hasta 10 letras o números.`,
        'INVALID_RECEIPT_PREFIX',
      );
    }
    return prefix;
  },

  compose(prefix: string, year: number, sequence: number): string {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE) {
      throw new BusinessRuleViolationError(
        `El consecutivo de recibos del año ${year} se agotó.`,
        'RECEIPT_SEQUENCE_EXHAUSTED',
      );
    }
    return `${ReceiptNumber.normalizePrefix(prefix)}-${year}-${String(sequence).padStart(6, '0')}`;
  },
};
