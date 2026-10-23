import type { Role } from '../../../../shared/domain/role.js';

export type StudentGender = 'M' | 'F' | 'O';

/** What the academic context needs to know about a student (owned by the students context). */
export interface StudentSummary {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  gender: StudentGender;
  phone: string | null;
  /** Current classroom (`students.classroom_id`): the de-facto enrollment. */
  classroomId: number | null;
  isActive: boolean;
}

/** "APELLIDO NOMBRE" as printed on rosters and report cards. */
export const studentDisplayName = (student: Pick<StudentSummary, 'firstName' | 'lastName'>): string =>
  `${student.lastName} ${student.firstName}`.trim();

/** The signed-in user whose linked students are requested. */
export interface StudentPortalUser {
  userId: number;
  email: string;
  role: Role;
}

/**
 * Read-only port over the students context (anti-corruption layer). The
 * academic module never imports the students module.
 */
export interface StudentDirectoryPort {
  findById(id: number): Promise<StudentSummary | null>;
  findByIds(ids: readonly number[]): Promise<StudentSummary[]>;
  /** Active students of a classroom ordered by last name, first name. */
  listActiveByClassroom(classroomId: number): Promise<StudentSummary[]>;
  /** Active students per classroom id (classrooms without students are absent from the map). */
  countActiveByClassroom(classroomIds: readonly number[]): Promise<Map<number, number>>;
  /**
   * Students a portal user may see: the student record of a `student` user, or
   * the children of a `parent` user (guardian linked by `user_id`, or by e-mail
   * as a fallback). Empty for other roles.
   */
  linkedStudentIds(user: StudentPortalUser): Promise<number[]>;
}

export const STUDENT_DIRECTORY = Symbol('StudentDirectoryPort');
