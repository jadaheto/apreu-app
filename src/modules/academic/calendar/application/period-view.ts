import type { AcademicPeriod, PeriodStatus } from '../domain/academic-period.js';

/** Read model of an academic period. */
export interface PeriodView {
  id: number;
  name: string;
  academicYear: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: Date | null;
  /** Grades can be recorded only while the period is open. */
  acceptsGrades: boolean;
}

export const toPeriodView = (period: AcademicPeriod): PeriodView => ({
  id: period.id as number,
  name: period.name,
  academicYear: period.academicYear,
  startDate: period.startDate,
  endDate: period.endDate,
  status: period.status,
  closedAt: period.closedAt,
  acceptsGrades: period.isOpen,
});
