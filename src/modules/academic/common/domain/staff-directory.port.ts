/** What the academic context needs to know about an employee (owned by the HR context). */
export interface StaffMember {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  /** `employees.employee_type`: docente, administrativo, directivo, servicios, otro. */
  employeeType: string;
  /** `employees.status`: active, inactive, suspended, retired, on_leave. */
  status: string;
}

/** Employee types allowed to teach a subject or direct a group. */
export const TEACHING_EMPLOYEE_TYPES: readonly string[] = ['docente', 'directivo'];

/**
 * Teaching assignments and group directorships only go to active teachers or
 * directors (legacy `academic/index.php:136`; `assignments.php` did not filter
 * the type, which the new rules fix).
 */
export const canTeach = (member: StaffMember): boolean =>
  member.status === 'active' && TEACHING_EMPLOYEE_TYPES.includes(member.employeeType);

export const staffDisplayName = (member: Pick<StaffMember, 'firstName' | 'lastName'>): string =>
  `${member.firstName} ${member.lastName}`.trim();

/** Read-only port over the HR context (anti-corruption layer). */
export interface StaffDirectoryPort {
  findById(id: number): Promise<StaffMember | null>;
  findByIds(ids: readonly number[]): Promise<StaffMember[]>;
  /** Employee linked to a user by `employees.user_id`, falling back to the e-mail. */
  findByUser(userId: number, email: string): Promise<StaffMember | null>;
  /** Active employees of type docente/directivo ordered by name. */
  listTeachingStaff(): Promise<StaffMember[]>;
}

export const STAFF_DIRECTORY = Symbol('StaffDirectoryPort');
