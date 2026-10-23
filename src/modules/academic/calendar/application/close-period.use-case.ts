import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';
import { toPeriodView, type PeriodView } from './period-view.js';

/** Payload of `academic.period-closed` (see `docs/eventos-integracion.md`). */
export interface PeriodClosedPayload {
  periodId: number;
  name: string;
  academicYear: number;
}

export const PERIOD_CLOSED_EVENT = 'academic.period-closed';

/**
 * Closes an open period so teachers can no longer grade it (legacy
 * `update_status=closed`, which updated every period: B2) and publishes
 * `academic.period-closed`.
 */
@Injectable()
export class ClosePeriodUseCase implements UseCase<number, PeriodView> {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(periodId: number): Promise<PeriodView> {
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    const now = this.clock.now();
    period.close(now);
    await this.periods.save(period);
    await this.events.publish({
      name: PERIOD_CLOSED_EVENT,
      occurredAt: now,
      payload: { periodId, name: period.name, academicYear: period.academicYear } satisfies PeriodClosedPayload,
    });
    return toPeriodView(period);
  }
}
