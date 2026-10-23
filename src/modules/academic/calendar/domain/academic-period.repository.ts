import type { AcademicPeriod } from './academic-period.js';

/** Output port for {@link AcademicPeriod} (`academic_periods`). */
export interface AcademicPeriodRepository {
  findById(id: number): Promise<AcademicPeriod | null>;
  findByIds(ids: readonly number[]): Promise<AcademicPeriod[]>;
  /** Periods of a year ordered by start date. */
  listByYear(year: number): Promise<AcademicPeriod[]>;
  /** True when `student_grades` reference the period. */
  hasGrades(periodId: number): Promise<boolean>;
  save(period: AcademicPeriod): Promise<void>;
  delete(id: number): Promise<void>;
}

export const ACADEMIC_PERIOD_REPOSITORY = Symbol('AcademicPeriodRepository');
