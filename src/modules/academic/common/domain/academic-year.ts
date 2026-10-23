import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';

export const MIN_ACADEMIC_YEAR = 2000;
export const MAX_ACADEMIC_YEAR = 2100;

/**
 * Validates an academic year (`YEAR(4)` columns such as `classrooms.academic_year`).
 * The current year of a school comes from `settings.academic_year`.
 */
export const assertAcademicYear = (year: number): number => {
  if (!Number.isInteger(year)) {
    throw new BusinessRuleViolationError('El año lectivo debe ser un número entero.', 'INVALID_ACADEMIC_YEAR');
  }
  Guard.inRange(year, MIN_ACADEMIC_YEAR, MAX_ACADEMIC_YEAR, 'año lectivo');
  return year;
};
