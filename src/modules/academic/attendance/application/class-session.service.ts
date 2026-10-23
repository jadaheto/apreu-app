import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { BusinessRuleViolationError, ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { requireFound } from '../../common/domain/require-found.js';
import type { StaffMember } from '../../common/domain/staff-directory.port.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import type { Classroom } from '../../structure/domain/classroom.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../../structure/domain/structure.repositories.js';

/** Classroom of the class and the employee taking attendance. */
export interface ClassSession {
  classroom: Classroom;
  employee: StaffMember;
}

/**
 * Authorizes taking attendance for a subject in a classroom (fixes S1/B28):
 * the subject must be assigned in the classroom for its academic year, the
 * employee is always the authenticated user (never a client-sent id) and a
 * teacher may only take attendance in their own assignments.
 */
@Injectable()
export class ClassSessionService {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    private readonly access: AcademicAccessService,
  ) {}

  async open(actor: AuthenticatedActor, classroomId: number, subjectId: number): Promise<ClassSession> {
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const employee = await this.access.requireEmployee(actor);
    const assignment = await this.assignments.findOne(subjectId, classroomId, classroom.academicYear);
    if (!assignment) {
      throw new BusinessRuleViolationError(
        `La materia no tiene docente asignado en el salón "${classroom.name}".`,
        'SUBJECT_NOT_ASSIGNED',
      );
    }
    if (!this.access.isAdministrator(actor) && !assignment.isTaughtBy(employee.id)) {
      throw new ForbiddenError('No tiene asignada esta materia en este salón.');
    }
    return { classroom, employee };
  }
}
