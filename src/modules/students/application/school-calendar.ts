import type { ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { InstitutionProfile } from '../domain/institution-settings.port.js';

/** Colombia does not observe daylight saving time: UTC−5 all year. */
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Current day in Colombia as `YYYY-MM-DD`. */
export const todayIn = (clock: ClockPort): string =>
  new Date(clock.now().getTime() + COLOMBIA_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Academic year in force: `settings.academic_year`, or the calendar year when
 * not configured. Replaces the two divergent legacy sources (`ACADEMIC_YEAR`
 * constant vs setting) and the `date('Y')` printed on ID cards (bug B21).
 */
export const academicYearOf = (institution: InstitutionProfile, clock: ClockPort): number =>
  institution.academicYear ?? Number(todayIn(clock).slice(0, 4));
