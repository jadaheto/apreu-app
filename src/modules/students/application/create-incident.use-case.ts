import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Incident, type IncidentPriority, type IncidentType } from '../domain/incident.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { IncidentViewAssembler, type IncidentDetailView } from './incident-view.assembler.js';

export interface CreateIncidentInput {
  actor: AuthenticatedActor;
  type?: IncidentType;
  priority?: IncidentPriority;
  title: string;
  description?: string | null;
  studentId?: number | null;
}

/**
 * Staff creates a request (legacy `incidents/index.php`, `create_incident`).
 * Type and priority are validated against their catalogs and the optional
 * student must exist (legacy validated nothing but the title).
 */
@Injectable()
export class CreateIncidentUseCase implements UseCase<CreateIncidentInput, IncidentDetailView> {
  constructor(
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly assembler: IncidentViewAssembler,
  ) {}

  async execute(input: CreateIncidentInput): Promise<IncidentDetailView> {
    const studentId = input.studentId ?? null;
    if (studentId !== null && !(await this.students.findById(studentId))) {
      throw new NotFoundError('Estudiante', studentId);
    }
    const incident = Incident.open({
      studentId,
      requestedBy: input.actor.userId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      description: input.description,
      openedAt: this.clock.now(),
    });
    await this.incidents.save(incident);
    return this.assembler.toView(incident);
  }
}
