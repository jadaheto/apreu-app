import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

/** Fails with `OUT_OF_RANGE` unless the value is an integer within `[min, max]`. */
export const assertIntegerInRange = (value: number, min: number, max: number, field: string): number => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BusinessRuleViolationError(
      `El campo "${field}" debe ser un número entero entre ${min} y ${max}.`,
      'OUT_OF_RANGE',
      { field, min, max },
    );
  }
  return value;
};
