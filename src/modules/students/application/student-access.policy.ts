import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { GUARDIAN_REPOSITORY, type GuardianRepository } from '../domain/guardian.repository.js';
import type { Student } from '../domain/student.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';

/** Staff roles allowed to read a student's record (writes are restricted to admin in the controllers). */
export const STUDENT_READER_ROLES: readonly Role[] = [Role.ADMIN, Role.FINANCE, Role.HR];

/**
 * Ownership rule for student data (fixes the IDORs S2/S3 of
 * `students/view.php`, `students/portal.php` and `student/*.php`, which
 * trusted the `student_id` of the query string):
 *
 * - `superadmin` and the given staff roles see every student;
 * - a `student` only sees the student linked to their user (`students.user_id`);
 * - a `parent` only sees students whose guardian is linked to their user
 *   (`guardians.user_id`);
 * - anyone else is rejected.
 */
@Injectable()
export class StudentAccessPolicy {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(GUARDIAN_REPOSITORY) private readonly guardians: GuardianRepository,
  ) {}

  /** Loads the student checking that the actor may see it. */
  async load(
    actor: AuthenticatedActor,
    studentId: number,
    staffRoles: readonly Role[] = STUDENT_READER_ROLES,
  ): Promise<Student> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);
    if (!(await this.canAccess(actor, student, staffRoles))) {
      throw new ForbiddenError('No tiene permisos para consultar este estudiante.');
    }
    return student;
  }

  /** True when the actor is staff with one of `staffRoles`, the student or their guardian. */
  async canAccess(actor: AuthenticatedActor, student: Student, staffRoles: readonly Role[]): Promise<boolean> {
    if (actor.role === Role.SUPERADMIN || staffRoles.includes(actor.role)) return true;
    if (actor.role === Role.STUDENT) return student.userId === actor.userId;
    if (actor.role === Role.PARENT && student.guardianId !== null) {
      const guardian = await this.guardians.findById(student.guardianId);
      return guardian?.userId === actor.userId;
    }
    return false;
  }
}
