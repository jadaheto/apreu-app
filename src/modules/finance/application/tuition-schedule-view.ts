import type { TuitionSchedule } from '../domain/tuition-schedule.js';

/** Read model of the yearly tuition rates. */
export interface TuitionScheduleView {
  academicYear: number;
  rates: { gradeId: number; conceptId: number | null; amount: number }[];
}

export const toTuitionScheduleView = (schedule: TuitionSchedule): TuitionScheduleView => ({
  academicYear: schedule.academicYear,
  rates: schedule.all.map((rate) => ({ gradeId: rate.gradeId, conceptId: rate.conceptId, amount: rate.amount.amount })),
});
