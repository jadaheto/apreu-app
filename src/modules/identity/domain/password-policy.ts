import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Password rules for new passwords. The legacy system had none; the new
 * minimum is 8 characters with at least one letter and one digit.
 */
export const assertStrongPassword = (password: string): void => {
  if (!password || password.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new BusinessRuleViolationError(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres e incluir letras y números.`,
      'WEAK_PASSWORD',
    );
  }
};
