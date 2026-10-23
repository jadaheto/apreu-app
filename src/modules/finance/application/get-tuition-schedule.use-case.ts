import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { TUITION_SCHEDULE_REPOSITORY, type TuitionScheduleRepository } from '../domain/tuition-schedule.repository.js';
import { toTuitionScheduleView, type TuitionScheduleView } from './tuition-schedule-view.js';

/** Tuition rates of a year; defaults to the configured academic year. */
@Injectable()
export class GetTuitionScheduleUseCase implements UseCase<{ year?: number }, TuitionScheduleView> {
  constructor(
    @Inject(TUITION_SCHEDULE_REPOSITORY) private readonly schedules: TuitionScheduleRepository,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
  ) {}

  async execute({ year }: { year?: number }): Promise<TuitionScheduleView> {
    const academicYear = year ?? (await this.settings.load()).academicYear;
    return toTuitionScheduleView(await this.schedules.findByYear(academicYear));
  }
}
