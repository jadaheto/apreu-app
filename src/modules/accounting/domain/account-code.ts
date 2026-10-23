import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

/** PUC hierarchy levels: 1 Clase, 2 Grupo, 3 Cuenta, 4 Subcuenta, 5 Auxiliar. */
export type AccountLevel = 1 | 2 | 3 | 4 | 5;

export const ACCOUNT_LEVEL_NAMES: Record<AccountLevel, string> = {
  1: 'Clase',
  2: 'Grupo',
  3: 'Cuenta',
  4: 'Subcuenta',
  5: 'Auxiliar',
};

/** Number of digits that identify each level (auxiliaries use 8 or more). */
export const LEVEL_CODE_LENGTH: Record<AccountLevel, number> = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 8 };

const DIGITS = /^\d+$/;

/**
 * Code of an account of the Colombian chart of accounts (PUC).
 *
 * RN-ACC-01/02: numeric, up to 20 digits, with a length that identifies its
 * level (1, 2, 4, 6 or 8+ digits). The legacy `accounts.php` did not validate
 * codes at all.
 */
export class AccountCode extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): AccountCode {
    const code = (raw ?? '').trim();
    const validLength = [1, 2, 4, 6].includes(code.length) || (code.length >= 8 && code.length <= 20);
    if (!DIGITS.test(code) || !validLength) {
      throw new BusinessRuleViolationError(
        'El código de la cuenta debe ser numérico de 1, 2, 4, 6 u 8 a 20 dígitos (Clase, Grupo, Cuenta, Subcuenta, Auxiliar).',
        'INVALID_ACCOUNT_CODE',
        { code },
      );
    }
    return new AccountCode(code);
  }

  /** Rebuilds a stored code without validation (legacy data may not follow the PUC). */
  static fromPersistence(raw: string): AccountCode {
    return new AccountCode(raw);
  }

  get level(): AccountLevel {
    const length = this.value.length;
    if (length <= 1) return 1;
    if (length <= 3) return 2;
    if (length <= 5) return 3;
    if (length <= 7) return 4;
    return 5;
  }

  /** True when this code is a proper prefix of `other` (i.e. an ancestor in the PUC). */
  isAncestorOf(other: AccountCode): boolean {
    return other.value.length > this.value.length && other.value.startsWith(this.value);
  }

  /** Code truncated to the given level (the code itself when it is shorter). */
  truncateTo(level: AccountLevel): string {
    return this.value.slice(0, LEVEL_CODE_LENGTH[level]);
  }

  toString(): string {
    return this.value;
  }
}
