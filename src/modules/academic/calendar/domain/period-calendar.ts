import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import type { AcademicPeriod } from './academic-period.js';

/**
 * Domain service with the rules that span every period of a year
 * (legacy B19: several `open` periods could coexist; no overlap validation).
 */
export const PeriodCalendar = {
  /** Fails when `period` overlaps another period of the same year. */
  assertNoOverlap(period: AcademicPeriod, periodsOfYear: readonly AcademicPeriod[]): void {
    const clash = periodsOfYear.find((other) => !other.equals(period) && other.overlaps(period));
    if (clash) {
      throw new BusinessRuleViolationError(
        `Las fechas se cruzan con el período "${clash.name}" (${clash.startDate} → ${clash.endDate}).`,
        'PERIOD_OVERLAP',
        { periodId: clash.id },
      );
    }
  },

  /** Closes every other open period of the year so that at most one stays open. */
  closeOthers(period: AcademicPeriod, periodsOfYear: readonly AcademicPeriod[], at: Date): AcademicPeriod[] {
    const others = periodsOfYear.filter((other) => !other.equals(period) && other.isOpen);
    others.forEach((other) => other.close(at));
    return others;
  },

  /** 1-based position of the period inside its year by start date (legacy `student_grades.period`). */
  ordinalOf(period: AcademicPeriod, periodsOfYear: readonly AcademicPeriod[]): number {
    const ordered = [...periodsOfYear].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const index = ordered.findIndex((other) => other.equals(period));
    return index === -1 ? ordered.length + 1 : index + 1;
  },
};
