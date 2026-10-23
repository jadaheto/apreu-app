import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ACADEMIC_PERFORMANCE, type AcademicPerformancePort } from '../domain/academic-performance.port.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { STUDENT_FINANCE, type FinancialSummary, type StudentFinancePort } from '../domain/student-finance.port.js';
import { academicYearOf, todayIn } from './school-calendar.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import { toIncidentView, type IncidentView, type StudentSummaryView } from './views.js';

export interface GetPortalDashboardInput {
  actor: AuthenticatedActor;
  studentId: number;
}

export interface PortalDashboardView {
  student: StudentSummaryView;
  finance: FinancialSummary;
  performance: {
    academicYear: number;
    average: number | null;
    percentage: number | null;
    recordCount: number;
  };
  recentIncidents: IncidentView[];
}

const MAX_SCORE = 5;
const RECENT_INCIDENTS = 5;

/**
 * Portal home of a student/guardian (legacy `student/index.php`): balance
 * from `student_charges` (B15), average of the year's final scores (rule 21:
 * one decimal, 0-5 scale, percentage = average / 5) and last 5 incidents.
 */
@Injectable()
export class GetPortalDashboardUseCase implements UseCase<GetPortalDashboardInput, PortalDashboardView> {
  constructor(
    private readonly access: StudentAccessPolicy,
    private readonly assembler: StudentViewAssembler,
    @Inject(STUDENT_FINANCE) private readonly finance: StudentFinancePort,
    @Inject(ACADEMIC_PERFORMANCE)
    private readonly performance: AcademicPerformancePort,
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, studentId }: GetPortalDashboardInput): Promise<PortalDashboardView> {
    const student = await this.access.load(actor, studentId, []);
    const academicYear = academicYearOf(await this.settings.load(), this.clock);
    const [[summary], finance, performance, incidents] = await Promise.all([
      this.assembler.toSummaries([student]),
      this.finance.summary(studentId, todayIn(this.clock)),
      this.performance.forYear(studentId, academicYear),
      this.incidents.search({ studentId }, { page: 1, limit: RECENT_INCIDENTS }),
    ]);
    const average = performance.average === null ? null : Math.round(performance.average * 10) / 10;
    return {
      student: summary,
      finance,
      performance: {
        academicYear,
        average,
        percentage: average === null ? null : Math.round((average / MAX_SCORE) * 100),
        recordCount: performance.recordCount,
      },
      recentIncidents: incidents.items.map(toIncidentView),
    };
  }
}
