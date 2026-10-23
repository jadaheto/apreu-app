import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { IncidentStatus } from '../domain/incident.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';

/** Count of incidents per status, including `closed` (missing in the legacy KPIs, bug B24). */
@Injectable()
export class GetIncidentKpisUseCase implements UseCase<void, Record<IncidentStatus, number>> {
  constructor(@Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository) {}

  execute(): Promise<Record<IncidentStatus, number>> {
    return this.incidents.countByStatus();
  }
}
