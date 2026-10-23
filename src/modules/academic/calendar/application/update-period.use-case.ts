import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import type { PeriodSchedule } from '../domain/academic-period.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';
import { PeriodCalendar } from '../domain/period-calendar.js';
import { toPeriodView, type PeriodView } from './period-view.js';

export interface UpdatePeriodInput extends PeriodSchedule {
  periodId: number;
}

/** Renames or reschedules a period, re-validating its dates (new). */
@Injectable()
export class UpdatePeriodUseCase implements UseCase<UpdatePeriodInput, PeriodView> {
  constructor(@Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository) {}

  async execute({ periodId, ...schedule }: UpdatePeriodInput): Promise<PeriodView> {
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    period.reschedule(schedule);
    PeriodCalendar.assertNoOverlap(period, await this.periods.listByYear(period.academicYear));
    await this.periods.save(period);
    return toPeriodView(period);
  }
}
