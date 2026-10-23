import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { ValueObject } from '../../../shared/domain/value-object.js';

/**
 * Institutional student code `AL{YYYY}{NNNN}` (e.g. `AL20260001`).
 *
 * Legacy `students/create.php:81-84` computed the sequence as
 * `COUNT(*) + 1` of the year, which collided after deletions and under
 * concurrency (bug B11). The sequence now comes from a transactional
 * per-year counter ({@link StudentCodeSequencePort}); numbers are never reused.
 * The code is immutable after enrollment.
 */
export class StudentCode extends ValueObject<string> {
  static readonly PREFIX = 'AL';
  private static readonly SEQUENCE_DIGITS = 4;

  private constructor(value: string) {
    super(value);
  }

  /** Builds the code for the given academic year and sequence number (≥ 1). */
  static compose(year: number, sequence: number): StudentCode {
    if (!Number.isInteger(year) || !Number.isInteger(sequence)) {
      throw new BusinessRuleViolationError(
        'El año y la secuencia del código deben ser enteros.',
        'INVALID_STUDENT_CODE',
      );
    }
    Guard.inRange(year, 2000, 2999, 'año del código');
    Guard.inRange(sequence, 1, 99_999_999, 'secuencia del código');
    return new StudentCode(
      `${StudentCode.PREFIX}${year}${String(sequence).padStart(StudentCode.SEQUENCE_DIGITS, '0')}`,
    );
  }

  /** Rebuilds a persisted code without validation (legacy data may differ). */
  static restore(raw: string): StudentCode {
    return new StudentCode(raw);
  }

  toString(): string {
    return this.value;
  }
}
