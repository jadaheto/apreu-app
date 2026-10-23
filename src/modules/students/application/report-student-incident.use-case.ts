import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Incident, PORTAL_INCIDENT_TYPES, type IncidentType } from '../domain/incident.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toIncidentView, type IncidentView } from './views.js';

export interface ReportStudentIncidentInput {
  actor: AuthenticatedActor;
  studentId: number;
  type?: IncidentType;
  title: string;
  description?: string | null;
}

/**
 * A student or guardian reports an incident about their own student (legacy
 * `student/incidencias.php`). Fixes S3 (ownership) and B19: the type must be
 * a valid `incidents.type` (the legacy categories did not exist in the enum).
 */
@Injectable()
export class ReportStudentIncidentUseCase implements UseCase<ReportStudentIncidentInput, IncidentView> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: ReportStudentIncidentInput): Promise<IncidentView> {
    await this.access.load(input.actor, input.studentId, []);
    const type = input.type ?? 'otra';
    Guard.oneOf(type, PORTAL_INCIDENT_TYPES, 'tipo de incidencia');
    const incident = Incident.open({
      studentId: input.studentId,
      requestedBy: input.actor.userId,
      type,
      title: input.title,
      description: input.description,
      openedAt: this.clock.now(),
    });
    await this.incidents.save(incident);
    return toIncidentView(incident);
  }
}
