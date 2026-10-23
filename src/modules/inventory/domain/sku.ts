import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._\-/]{0,49}$/;

/**
 * Stock keeping unit (RN-INV-01): mandatory, unique, up to 50 characters of
 * letters, digits and `. _ - /`, stored in upper case.
 */
export class Sku extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Sku {
    const sku = (raw ?? '').trim().toUpperCase();
    if (!SKU_PATTERN.test(sku)) {
      throw new BusinessRuleViolationError(
        'El SKU es obligatorio (máx. 50 caracteres: letras, números y . _ - /).',
        'INVALID_SKU',
      );
    }
    return new Sku(sku);
  }

  /** Rebuilds a stored SKU without validation (legacy values were never validated). */
  static fromPersistence(raw: string): Sku {
    return new Sku(raw);
  }

  toString(): string {
    return this.value;
  }
}
