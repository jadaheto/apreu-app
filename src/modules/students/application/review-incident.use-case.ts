import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { ReviewAction } from '../domain/incident.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { IncidentViewAssembler, type IncidentDetailView } from './incident-view.assembler.js';

export interface ReviewIncidentInput {
  actor: AuthenticatedActor;
  incidentId: number;
  action: ReviewAction;
  notes?: string | null;
}

/**
 * Puts an incident in review, approves, rejects or closes it, enforcing the
 * state machine (fixes S7) and recording the reviewer (`users.id`) and notes.
 */
@Injectable()
export class ReviewIncidentUseCase implements UseCase<ReviewIncidentInput, IncidentDetailView> {
  constructor(
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: IncidentViewAssembler,
  ) {}

  async execute({ actor, incidentId, action, notes }: ReviewIncidentInput): Promise<IncidentDetailView> {
    const incident = await this.incidents.findById(incidentId);
    if (!incident) throw new NotFoundError('Incidencia', incidentId);
    incident.review(action, actor.userId, notes, this.clock.now());
    await this.incidents.save(incident);
    return this.assembler.toView(incident);
  }
}
