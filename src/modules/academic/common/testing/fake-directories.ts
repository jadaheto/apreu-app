import { Role } from '../../../../shared/domain/role.js';
import type { AcademicSettingsPort, InstitutionProfile } from '../domain/academic-settings.port.js';
import type { StaffDirectoryPort, StaffMember } from '../domain/staff-directory.port.js';
import type { StudentDirectoryPort, StudentPortalUser, StudentSummary } from '../domain/student-directory.port.js';

let studentSequence = 0;

/** Builds a student with sensible defaults for tests. */
export const aStudent = (overrides: Partial<StudentSummary> = {}): StudentSummary => {
  const id = overrides.id ?? ++studentSequence + 5000;
  return {
    id,
    code: `E${id}`,
    firstName: 'Ana',
    lastName: `Pérez ${id}`,
    documentType: 'TI',
    documentNumber: `10${id}`,
    gender: 'F',
    phone: null,
    classroomId: null,
    isActive: true,
    ...overrides,
  };
};

/** In-memory students directory; `links` maps a user id to the students it may see. */
export class FakeStudentDirectory implements StudentDirectoryPort {
  readonly students = new Map<number, StudentSummary>();
  readonly links = new Map<number, number[]>();

  add(...students: StudentSummary[]): this {
    students.forEach((student) => this.students.set(student.id, student));
    return this;
  }

  link(userId: number, ...studentIds: number[]): this {
    this.links.set(userId, studentIds);
    return this;
  }

  async findById(id: number): Promise<StudentSummary | null> {
    return this.students.get(id) ?? null;
  }

  async findByIds(ids: readonly number[]): Promise<StudentSummary[]> {
    return ids.flatMap((id) => this.students.get(id) ?? []);
  }

  async listActiveByClassroom(classroomId: number): Promise<StudentSummary[]> {
    return [...this.students.values()]
      .filter((s) => s.classroomId === classroomId && s.isActive)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  }

  async countActiveByClassroom(classroomIds: readonly number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    for (const student of this.students.values()) {
      if (student.isActive && student.classroomId !== null && classroomIds.includes(student.classroomId)) {
        counts.set(student.classroomId, (counts.get(student.classroomId) ?? 0) + 1);
      }
    }
    return counts;
  }

  async linkedStudentIds(user: StudentPortalUser): Promise<number[]> {
    if (user.role !== Role.STUDENT && user.role !== Role.PARENT) return [];
    return this.links.get(user.userId) ?? [];
  }
}

let staffSequence = 0;

export const aStaffMember = (overrides: Partial<StaffMember> = {}): StaffMember => {
  const id = overrides.id ?? ++staffSequence + 3000;
  return {
    id,
    code: `D${id}`,
    firstName: 'Carlos',
    lastName: `Ruiz ${id}`,
    employeeType: 'docente',
    status: 'active',
    ...overrides,
  };
};

/** In-memory HR directory; `users` maps a user id to an employee id. */
export class FakeStaffDirectory implements StaffDirectoryPort {
  readonly members = new Map<number, StaffMember>();
  readonly users = new Map<number, number>();

  add(member: StaffMember, userId?: number): this {
    this.members.set(member.id, member);
    if (userId !== undefined) this.users.set(userId, member.id);
    return this;
  }

  async findById(id: number): Promise<StaffMember | null> {
    return this.members.get(id) ?? null;
  }

  async findByIds(ids: readonly number[]): Promise<StaffMember[]> {
    return ids.flatMap((id) => this.members.get(id) ?? []);
  }

  async findByUser(userId: number): Promise<StaffMember | null> {
    const id = this.users.get(userId);
    return id === undefined ? null : (this.members.get(id) ?? null);
  }

  async listTeachingStaff(): Promise<StaffMember[]> {
    return [...this.members.values()].filter(
      (m) => m.status === 'active' && ['docente', 'directivo'].includes(m.employeeType),
    );
  }
}

/** Fixed school settings. */
export class FakeAcademicSettings implements AcademicSettingsPort {
  constructor(
    public year = 2026,
    public profile: InstitutionProfile = { name: 'Colegio Demo', nit: '900.1', address: 'Calle 1', logo: null },
  ) {}

  async currentAcademicYear(): Promise<number> {
    return this.year;
  }

  async institutionProfile(): Promise<InstitutionProfile> {
    return this.profile;
  }
}
