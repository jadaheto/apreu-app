import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { AcademicPeriod, type PeriodSchedule } from '../domain/academic-period.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';
import { PeriodCalendar } from '../domain/period-calendar.js';
import { toPeriodView, type PeriodView } from './period-view.js';

export interface CreatePeriodInput extends PeriodSchedule {
  /** Defaults to `settings.academic_year`. */
  academicYear?: number;
}

/**
 * Creates a period (legacy action `create_period`). Dates must start inside
 * the year and not overlap other periods. The period starts `open` only when
 * the year has no open period; otherwise it is created `closed` (pending) so
 * the "one open period per year" invariant holds (B19).
 */
@Injectable()
export class CreatePeriodUseCase implements UseCase<CreatePeriodInput, PeriodView> {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
  ) {}

  async execute(input: CreatePeriodInput): Promise<PeriodView> {
    const academicYear = input.academicYear ?? (await this.settings.currentAcademicYear());
    const periodsOfYear = await this.periods.listByYear(academicYear);
    const period = AcademicPeriod.create({
      ...input,
      academicYear,
      open: !periodsOfYear.some((p) => p.isOpen),
    });
    PeriodCalendar.assertNoOverlap(period, periodsOfYear);
    await this.periods.save(period);
    return toPeriodView(period);
  }
}
