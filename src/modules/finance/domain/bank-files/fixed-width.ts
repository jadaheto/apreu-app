import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

/**
 * Field helpers for fixed-width bank files. Fixes legacy bugs B30–B32: text is
 * normalized to upper-case ASCII (no accents, no multibyte characters) and
 * truncated by characters; numeric fields never overflow silently.
 */
export const FixedWidth = {
  /** Upper-case ASCII letters, digits and spaces only. */
  normalize(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /** Free text, right-padded with spaces and truncated to `length`. */
  text(value: string | null | undefined, length: number): string {
    return FixedWidth.normalize(value).slice(0, length).padEnd(length, ' ');
  },

  /** Identifier (document, reference) right-padded with spaces; fails when too long. */
  code(value: string | null | undefined, length: number, field: string): string {
    const normalized = FixedWidth.normalize(value).replace(/ /g, '');
    return FixedWidth.fit(normalized, length, field).padEnd(length, ' ');
  },

  /** Non-negative integer (or digit string) left-padded with zeros; fails when too long. */
  number(value: number | string, length: number, field: string): string {
    const digits = typeof value === 'number' ? String(Math.round(value)) : value.replace(/\D/g, '');
    return FixedWidth.fit(digits || '0', length, field).padStart(length, '0');
  },

  fit(value: string, length: number, field: string): string {
    if (value.length > length) {
      throw new BusinessRuleViolationError(
        `El campo "${field}" (${value}) supera ${length} posiciones del archivo bancario.`,
        'BANK_FILE_FIELD_OVERFLOW',
        { field, length },
      );
    }
    return value;
  },
};

/** Line separator required by the bank portals. */
export const BANK_FILE_EOL = '\r\n';
