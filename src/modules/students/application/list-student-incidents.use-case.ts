import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { mapPage, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toIncidentView, type IncidentView } from './views.js';

export interface ListStudentIncidentsInput {
  actor: AuthenticatedActor;
  studentId: number;
  page: PageRequest;
}

/**
 * Incidents of one student for the portal (legacy `student/incidencias.php`).
 * Owners only see their student's incidents — never school-wide counters (S8).
 */
@Injectable()
export class ListStudentIncidentsUseCase implements UseCase<ListStudentIncidentsInput, Paginated<IncidentView>> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
  ) {}

  async execute({ actor, studentId, page }: ListStudentIncidentsInput): Promise<Paginated<IncidentView>> {
    await this.access.load(actor, studentId);
    return mapPage(await this.incidents.search({ studentId }, page), toIncidentView);
  }
}
