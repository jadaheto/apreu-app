import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { BusinessRuleViolationError, ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { requireFound } from '../../common/domain/require-found.js';
import type { AcademicPeriod } from '../../calendar/domain/academic-period.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import type { Classroom } from '../../structure/domain/classroom.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../../structure/domain/structure.repositories.js';
import type { Subject } from '../../structure/domain/subject.js';
import type { TeachingAssignment } from '../../structure/domain/teaching-assignment.js';

/** Classroom, subject, assignment and period a grade sheet refers to. */
export interface GradingContext {
  classroom: Classroom;
  subject: Subject;
  assignment: TeachingAssignment;
  period: AcademicPeriod;
  /** Periods of the classroom's year (to number the period). */
  periodsOfYear: AcademicPeriod[];
}

/**
 * Resolves and authorizes a grade sheet (fixes S4): the subject must have a
 * teacher assigned in the classroom for the classroom's year, and a teacher may
 * only grade their own assignments. Admins may grade any assigned subject.
 * Without `periodId` the open period of the year is used.
 */
@Injectable()
export class GradingContextService {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    private readonly access: AcademicAccessService,
  ) {}

  async resolve(
    actor: AuthenticatedActor,
    input: { classroomId: number; subjectId: number; periodId?: number },
  ): Promise<GradingContext> {
    const classroom = requireFound(await this.classrooms.findById(input.classroomId), 'Salón', input.classroomId);
    const subject = requireFound(await this.subjects.findById(input.subjectId), 'Materia', input.subjectId);
    const assignment = await this.assignments.findOne(subject.id as number, input.classroomId, classroom.academicYear);
    if (!assignment) {
      throw new BusinessRuleViolationError(
        `La materia "${subject.name}" no tiene docente asignado en el salón "${classroom.name}".`,
        'SUBJECT_NOT_ASSIGNED',
      );
    }
    if (!this.access.isAdministrator(actor)) {
      const employee = await this.access.requireEmployee(actor);
      if (!assignment.isTaughtBy(employee.id)) {
        throw new ForbiddenError('No tiene asignada esta materia en este salón.');
      }
    }

    const periodsOfYear = await this.periods.listByYear(classroom.academicYear);
    return {
      classroom,
      subject,
      assignment,
      period: this.pickPeriod(periodsOfYear, input.periodId, classroom),
      periodsOfYear,
    };
  }

  private pickPeriod(
    periodsOfYear: AcademicPeriod[],
    periodId: number | undefined,
    classroom: Classroom,
  ): AcademicPeriod {
    if (periodId === undefined) {
      const open = periodsOfYear.find((p) => p.isOpen);
      if (!open) {
        throw new BusinessRuleViolationError(
          `No hay un período académico abierto en ${classroom.academicYear}.`,
          'NO_OPEN_PERIOD',
        );
      }
      return open;
    }
    const period = periodsOfYear.find((p) => p.id === periodId);
    if (!period) {
      throw new BusinessRuleViolationError(
        `El período ${periodId} no pertenece al año lectivo ${classroom.academicYear} del salón.`,
        'PERIOD_NOT_IN_YEAR',
      );
    }
    return period;
  }
}
