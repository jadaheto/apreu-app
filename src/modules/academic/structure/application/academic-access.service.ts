import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { requireFound } from '../../common/domain/require-found.js';
import {
  STAFF_DIRECTORY,
  type StaffDirectoryPort,
  type StaffMember,
} from '../../common/domain/staff-directory.port.js';
import {
  STUDENT_DIRECTORY,
  type StudentDirectoryPort,
  type StudentSummary,
} from '../../common/domain/student-directory.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GROUP_DIRECTORSHIP_REPOSITORY,
  type GroupDirectorshipRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';

/** Which academic records of a student are being read. */
export type StudentRecordKind = 'grades' | 'report-cards' | 'attendance';

const PORTAL_ROLES: readonly Role[] = [Role.STUDENT, Role.PARENT];

/**
 * Ownership-based authorization of the academic context (fixes the legacy
 * IDORs S2, S4, S5, S6). Rules:
 * - admin/superadmin: everything.
 * - student: only their own record; parent: only their linked children.
 * - staff: the group director of the student's classroom; for grades also the
 *   teachers assigned to that classroom in its academic year.
 */
@Injectable()
export class AcademicAccessService {
  constructor(
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(GROUP_DIRECTORSHIP_REPOSITORY) private readonly directorships: GroupDirectorshipRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
  ) {}

  isAdministrator(actor: AuthenticatedActor): boolean {
    return actor.role === Role.ADMIN || actor.role === Role.SUPERADMIN;
  }

  /** The employee record of the actor (teacher identity always comes from the token). */
  async requireEmployee(actor: AuthenticatedActor): Promise<StaffMember> {
    const employee = await this.staff.findByUser(actor.userId, actor.email);
    if (!employee) throw new ForbiddenError('Su usuario no está vinculado a un empleado del colegio.');
    return employee;
  }

  /** Loads a student the actor is allowed to read, or fails with 403/404. */
  async readableStudent(
    actor: AuthenticatedActor,
    studentId: number,
    kind: StudentRecordKind,
  ): Promise<StudentSummary> {
    if (PORTAL_ROLES.includes(actor.role)) {
      const linked = await this.students.linkedStudentIds({
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
      });
      if (!linked.includes(studentId)) {
        throw new ForbiddenError('Solo puede consultar la información de sus estudiantes vinculados.');
      }
    }
    const student = requireFound(await this.students.findById(studentId), 'Estudiante', studentId);
    if (this.isAdministrator(actor) || PORTAL_ROLES.includes(actor.role)) return student;

    const employee = await this.staff.findByUser(actor.userId, actor.email);
    if (employee && student.classroomId !== null) {
      if (await this.directs(employee.id, student.classroomId)) return student;
      if (kind === 'grades' && (await this.teachesIn(employee.id, student.classroomId))) return student;
    }
    throw new ForbiddenError('No tiene permisos para consultar la información de este estudiante.');
  }

  /** Admins, or the active group director of the classroom. */
  async assertDirectorOf(actor: AuthenticatedActor, classroomId: number): Promise<void> {
    if (this.isAdministrator(actor)) return;
    const employee = await this.requireEmployee(actor);
    if (!(await this.directs(employee.id, classroomId))) {
      throw new ForbiddenError('Solo el director de grupo puede consultar la información de este salón.');
    }
  }

  private async directs(employeeId: number, classroomId: number): Promise<boolean> {
    const directorship = await this.directorships.findActiveByClassroom(classroomId);
    return directorship?.employeeId === employeeId;
  }

  private async teachesIn(employeeId: number, classroomId: number): Promise<boolean> {
    const classroom = await this.classrooms.findById(classroomId);
    if (!classroom) return false;
    const assignments = await this.assignments.listByEmployee(employeeId, classroom.academicYear);
    return assignments.some((assignment) => assignment.classroomId === classroomId);
  }
}
