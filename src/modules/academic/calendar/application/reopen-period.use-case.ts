import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';
import { PeriodCalendar } from '../domain/period-calendar.js';
import { toPeriodView, type PeriodView } from './period-view.js';

/**
 * Reopens a closed period, closing first any other open period of the same
 * year (legacy `update_status=open`), atomically.
 */
@Injectable()
export class ReopenPeriodUseCase implements UseCase<number, PeriodView> {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(periodId: number): Promise<PeriodView> {
    return this.uow.runInTransaction(async () => {
      const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
      period.reopen();
      const closed = PeriodCalendar.closeOthers(
        period,
        await this.periods.listByYear(period.academicYear),
        this.clock.now(),
      );
      for (const other of closed) await this.periods.save(other);
      await this.periods.save(period);
      return toPeriodView(period);
    });
  }
}
