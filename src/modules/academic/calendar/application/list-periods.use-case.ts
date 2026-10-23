import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

/** Periods of a year (default `settings.academic_year`) ordered by start date. */
@Injectable()
export class ListPeriodsUseCase implements UseCase<{ year?: number }, PeriodView[]> {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
  ) {}

  async execute({ year }: { year?: number }): Promise<PeriodView[]> {
    const academicYear = year ?? (await this.settings.currentAcademicYear());
    return (await this.periods.listByYear(academicYear)).map(toPeriodView);
  }
}
