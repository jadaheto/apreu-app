import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { indexBy } from '../../common/domain/collections.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { REPORT_CARD_REPOSITORY, type ReportCardRepository } from '../domain/assessment.repositories.js';
import { classifyAverage, type Performance } from '../domain/performance-scale.js';
import { isPassingAverage } from '../domain/score.js';

export interface ReportCardSummaryView {
  periodId: number;
  periodName: string;
  academicYear: number;
  startDate: string;
  endDate: string;
  averageScore: number;
  passing: boolean;
  performance: Performance;
  generatedAt: Date;
  viewCount: number;
  lastViewedAt: Date | null;
  documentPath: string;
}

/**
 * Report card history of a student, newest first (legacy
 * `student/boletines.php`, now also for guardians: B24).
 */
@Injectable()
export class ListStudentReportCardsUseCase implements UseCase<
  { actor: AuthenticatedActor; studentId: number },
  ReportCardSummaryView[]
> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(REPORT_CARD_REPOSITORY) private readonly reportCards: ReportCardRepository,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
  ) {}

  async execute({
    actor,
    studentId,
  }: {
    actor: AuthenticatedActor;
    studentId: number;
  }): Promise<ReportCardSummaryView[]> {
    await this.access.readableStudent(actor, studentId, 'report-cards');
    const cards = await this.reportCards.listByStudent(studentId);
    const periods = indexBy(await this.periods.findByIds(cards.map((c) => c.periodId)), (p) => p.id as number);

    return cards
      .flatMap((card): ReportCardSummaryView[] => {
        const period = periods.get(card.periodId);
        if (!period) return [];
        return [
          {
            periodId: card.periodId,
            periodName: period.name,
            academicYear: period.academicYear,
            startDate: period.startDate,
            endDate: period.endDate,
            averageScore: card.averageScore,
            passing: isPassingAverage(card.averageScore),
            performance: classifyAverage(card.averageScore),
            generatedAt: card.generatedAt,
            viewCount: card.viewCount,
            lastViewedAt: card.lastViewedAt,
            documentPath: card.documentPath,
          },
        ];
      })
      .sort((a, b) => b.academicYear - a.academicYear || b.startDate.localeCompare(a.startDate));
  }
}
