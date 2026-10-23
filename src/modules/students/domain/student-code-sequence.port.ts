/**
 * Transactional counter of student codes per academic year.
 *
 * Implementations must lock the counter row (e.g. `SELECT … FOR UPDATE`) so
 * two concurrent enrollments never receive the same number, and must never
 * hand out a number twice even if students are deleted.
 */
export interface StudentCodeSequencePort {
  /** Reserves and returns the next sequence number (1-based) of the year. */
  next(year: number): Promise<number>;
}

export const STUDENT_CODE_SEQUENCE = Symbol('StudentCodeSequencePort');
