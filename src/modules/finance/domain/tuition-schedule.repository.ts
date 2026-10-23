import type { TuitionSchedule } from './tuition-schedule.js';

/** Output port for the yearly {@link TuitionSchedule}. */
export interface TuitionScheduleRepository {
  /** Rates of the year (empty schedule when none was configured). */
  findByYear(academicYear: number): Promise<TuitionSchedule>;
  /** Replaces every rate of the schedule's year; must run inside a unit of work. */
  replace(schedule: TuitionSchedule): Promise<void>;
}

export const TUITION_SCHEDULE_REPOSITORY = Symbol('TuitionScheduleRepository');
