import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Role } from '../../../../shared/domain/role.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { REPORT_CARD_REPOSITORY, type ReportCardRepository } from '../domain/assessment.repositories.js';
import type { ReportCardDocument } from './report-card-document.js';
import { ReportCardDocumentBuilder } from './report-card-document.builder.js';

export interface GetReportCardInput {
  actor: AuthenticatedActor;
  studentId: number;
  periodId: number;
}

const COUNTED_VIEWERS: readonly Role[] = [Role.STUDENT, Role.PARENT];

/**
 * A generated report card with access control (legacy
 * `academic/bulletin_view.php` was public: S2). When the student or a guardian
 * opens it, the view counter and date are recorded (B23).
 */
@Injectable()
export class GetReportCardUseCase implements UseCase<GetReportCardInput, ReportCardDocument> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(REPORT_CARD_REPOSITORY) private readonly reportCards: ReportCardRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly builder: ReportCardDocumentBuilder,
  ) {}

  async execute({ actor, studentId, periodId }: GetReportCardInput): Promise<ReportCardDocument> {
    const student = await this.access.readableStudent(actor, studentId, 'report-cards');
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    const card = requireFound(
      await this.reportCards.findOne(studentId, periodId),
      'Boletín',
      `${studentId}/${periodId}`,
    );
    if (COUNTED_VIEWERS.includes(actor.role)) {
      card.registerView(this.clock.now());
      await this.reportCards.save(card);
    }
    return this.builder.build(student, period, card);
  }
}
