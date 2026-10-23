import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../../shared/domain/value-object.js';

const COLOMBIA_CODE = '57';
const NATIONAL_LENGTH = 10;

/**
 * International phone number in the digits-only format WhatsApp Cloud API
 * expects (`573001234567`).
 *
 * RN-COM-11 (legacy `whatsapp/send.php`): non digits are removed and a
 * 10-digit Colombian number gets the `57` prefix. Unlike the legacy code,
 * invalid lengths are rejected instead of being sent to Meta, and the
 * normalized number is the one logged (legacy bug #27).
 */
export class PhoneNumber extends ValueObject<string> {
  private constructor(digits: string) {
    super(digits);
  }

  static create(raw: string): PhoneNumber {
    let digits = (raw ?? '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === NATIONAL_LENGTH) digits = COLOMBIA_CODE + digits;

    const isColombian = digits.startsWith(COLOMBIA_CODE);
    const valid = isColombian
      ? digits.length === COLOMBIA_CODE.length + NATIONAL_LENGTH
      : digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0');
    if (!valid) {
      throw new BusinessRuleViolationError(`Número de teléfono inválido: "${raw}".`, 'INVALID_PHONE');
    }
    return new PhoneNumber(digits);
  }

  /** Digits only, as sent to Meta. */
  get digits(): string {
    return this.value;
  }

  /** `+573001234567`. */
  get e164(): string {
    return `+${this.value}`;
  }

  toString(): string {
    return this.value;
  }
}
