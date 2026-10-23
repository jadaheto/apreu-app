import { Inject, Injectable } from '@nestjs/common';
import type { Incident } from '../domain/incident.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { USER_ACCOUNTS, type UserAccountPort } from './ports/user-account.port.js';
import { toIncidentView, type IncidentView } from './views.js';

/** Incident with the names shown in the inbox. */
export interface IncidentDetailView extends IncidentView {
  studentName: string | null;
  requestedByName: string | null;
  /** Reviewer resolved from `users` (legacy joined `employees` by mistake, bug B2). */
  reviewedByName: string | null;
}

const distinct = (ids: (number | null)[]): number[] => [...new Set(ids.filter((id): id is number => id !== null))];

/** Enriches incidents with student and user names using batched lookups. */
@Injectable()
export class IncidentViewAssembler {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(USER_ACCOUNTS) private readonly users: UserAccountPort,
  ) {}

  async toViews(incidents: Incident[]): Promise<IncidentDetailView[]> {
    const [students, names] = await Promise.all([
      this.students.findByIds(distinct(incidents.map((i) => i.studentId))),
      this.users.displayNames(distinct(incidents.flatMap((i) => [i.requestedBy, i.reviewedBy]))),
    ]);
    const studentNames = new Map(students.map((s) => [s.id as number, s.fullName]));
    const nameOf = (map: Map<number, string>, id: number | null) => (id === null ? null : (map.get(id) ?? null));
    return incidents.map((incident) => ({
      ...toIncidentView(incident),
      studentName: nameOf(studentNames, incident.studentId),
      requestedByName: nameOf(names, incident.requestedBy),
      reviewedByName: nameOf(names, incident.reviewedBy),
    }));
  }

  async toView(incident: Incident): Promise<IncidentDetailView> {
    const [view] = await this.toViews([incident]);
    return view;
  }
}
