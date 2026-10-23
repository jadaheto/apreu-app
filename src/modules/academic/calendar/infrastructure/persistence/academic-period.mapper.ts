import { toIsoDate } from '../../../common/infrastructure/orm-support.js';
import { AcademicPeriod } from '../../domain/academic-period.js';
import { AcademicPeriodOrmEntity } from './academic-period.orm-entity.js';

/** Row ↔ aggregate translation for `academic_periods`. */
export const AcademicPeriodMapper = {
  toDomain: (row: AcademicPeriodOrmEntity): AcademicPeriod =>
    AcademicPeriod.restore(row.id, {
      name: row.name,
      academicYear: Number(row.academicYear),
      startDate: toIsoDate(row.startDate),
      endDate: toIsoDate(row.endDate),
      status: row.status ?? 'open',
      closedAt: row.closedAt,
    }),

  toPersistence: (period: AcademicPeriod): AcademicPeriodOrmEntity => {
    const row = new AcademicPeriodOrmEntity();
    if (period.id !== null) row.id = period.id;
    row.name = period.name;
    row.academicYear = period.academicYear;
    row.startDate = period.startDate;
    row.endDate = period.endDate;
    row.status = period.status;
    row.closedAt = period.closedAt;
    return row;
  },
};
