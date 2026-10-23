import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { Incident, IncidentStatus, IncidentType } from './incident.js';

export interface IncidentSearchCriteria {
  status?: IncidentStatus;
  type?: IncidentType;
  studentId?: number;
}

/** Output port for persisting {@link Incident} aggregates. */
export interface IncidentRepository {
  findById(id: number): Promise<Incident | null>;
  /** Most recent first. */
  search(criteria: IncidentSearchCriteria, page: PageRequest): Promise<Paginated<Incident>>;
  /** Number of incidents per status across the whole school. */
  countByStatus(): Promise<Record<IncidentStatus, number>>;
  save(incident: Incident): Promise<void>;
}

export const INCIDENT_REPOSITORY = Symbol('IncidentRepository');
