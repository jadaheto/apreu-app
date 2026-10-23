import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import {
  INCIDENT_REPOSITORY,
  type IncidentRepository,
  type IncidentSearchCriteria,
} from '../domain/incident.repository.js';
import { IncidentViewAssembler, type IncidentDetailView } from './incident-view.assembler.js';

export interface ListIncidentsInput {
  criteria: IncidentSearchCriteria;
  page: PageRequest;
}

/** Staff inbox of incidents, most recent first, filtered by status/type/student and paginated. */
@Injectable()
export class ListIncidentsUseCase implements UseCase<ListIncidentsInput, Paginated<IncidentDetailView>> {
  constructor(
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    private readonly assembler: IncidentViewAssembler,
  ) {}

  async execute({ criteria, page }: ListIncidentsInput): Promise<Paginated<IncidentDetailView>> {
    const result = await this.incidents.search(criteria, page);
    return { ...result, items: await this.assembler.toViews(result.items) };
  }
}
