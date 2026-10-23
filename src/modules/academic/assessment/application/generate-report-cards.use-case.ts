import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { groupBy, indexBy } from '../../common/domain/collections.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import {
  REPORT_CARD_REPOSITORY,
  type ReportCardRepository,
  STUDENT_GRADE_REPOSITORY,
  type StudentGradeRepository,
} from '../domain/assessment.repositories.js';
import { ReportCard } from '../domain/report-card.js';
import { averageOf } from '../domain/score.js';

/** Payload of `academic.bulletins-generated` (see `docs/eventos-integracion.md`). */
export interface BulletinsGeneratedPayload {
  periodId: number;
  studentIds: number[];
}

export const BULLETINS_GENERATED_EVENT = 'academic.bulletins-generated';

export interface GenerateReportCardsOutput {
  periodId: number;
  generated: number;
}

/**
 * Generates (or regenerates) the report cards of a closed period — legacy
 * `academic/close_period.php`. For every student with at least one grade in
 * the period (regardless of their current classroom: B21) the simple average
 * of final scores is stored; the period becomes `bulletins_generated`.
 * Fixes B3/B4 (updates without WHERE), B18 (open periods are rejected) and S7
 * (it is a POST). Publishes `academic.bulletins-generated`.
 */
@Injectable()
export class GenerateReportCardsUseCase implements UseCase<number, GenerateReportCardsOutput> {
  constructor(
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(STUDENT_GRADE_REPOSITORY) private readonly grades: StudentGradeRepository,
    @Inject(REPORT_CARD_REPOSITORY) private readonly reportCards: ReportCardRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(periodId: number): Promise<GenerateReportCardsOutput> {
    const now = this.clock.now();
    const studentIds = await this.uow.runInTransaction(async () => {
      const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
      period.markBulletinsGenerated();
      const gradesByStudent = groupBy(await this.grades.listByPeriod(periodId), (g) => g.studentId);
      if (gradesByStudent.size === 0) {
        throw new BusinessRuleViolationError(
          `No hay calificaciones registradas en el período "${period.name}".`,
          'NO_GRADES_IN_PERIOD',
        );
      }
      const existing = indexBy(await this.reportCards.listByPeriod(periodId), (c) => c.studentId);
      const cards = [...gradesByStudent].map(([studentId, grades]) => {
        const averageScore = averageOf(grades.map((g) => g.finalScore)) as number;
        const card = existing.get(studentId);
        if (!card) return ReportCard.generate({ studentId, periodId, averageScore, at: now });
        card.regenerate(averageScore, now);
        return card;
      });
      await this.reportCards.saveAll(cards);
      await this.periods.save(period);
      return [...gradesByStudent.keys()];
    });

    await this.events.publish({
      name: BULLETINS_GENERATED_EVENT,
      occurredAt: now,
      payload: { periodId, studentIds } satisfies BulletinsGeneratedPayload,
    });
    return { periodId, generated: studentIds.length };
  }
}
