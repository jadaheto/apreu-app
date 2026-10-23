import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { IncidentViewAssembler, type IncidentDetailView } from './incident-view.assembler.js';

/** Returns one incident with student, requester and reviewer names. */
@Injectable()
export class GetIncidentUseCase implements UseCase<number, IncidentDetailView> {
  constructor(
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    private readonly assembler: IncidentViewAssembler,
  ) {}

  async execute(incidentId: number): Promise<IncidentDetailView> {
    const incident = await this.incidents.findById(incidentId);
    if (!incident) throw new NotFoundError('Incidencia', incidentId);
    return this.assembler.toView(incident);
  }
}
