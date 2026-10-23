import { InMemoryStore } from '../../../../shared/testing/fakes.js';
import type { Classroom } from '../domain/classroom.js';
import { EDUCATION_LEVELS, type Grade } from '../domain/grade.js';
import type { GroupDirectorship } from '../domain/group-directorship.js';
import type {
  ClassroomRepository,
  GradeRepository,
  GroupDirectorshipRepository,
  SubjectRepository,
  TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';
import type { Subject } from '../domain/subject.js';
import type { TeachingAssignment } from '../domain/teaching-assignment.js';

type StoredEntity = { id: number | null; isNew: boolean; assignId(id: number): void };

const byIds = <T extends StoredEntity>(store: InMemoryStore<T>, ids: readonly number[]): T[] =>
  ids.flatMap((id) => store.get(id) ?? []);

export class InMemoryGradeRepository implements GradeRepository {
  readonly store = new InMemoryStore<Grade>();
  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: readonly number[]) {
    return byIds(this.store, ids);
  }
  async listAll() {
    return this.store
      .all()
      .sort(
        (a, b) => EDUCATION_LEVELS.indexOf(a.level) - EDUCATION_LEVELS.indexOf(b.level) || a.name.localeCompare(b.name),
      );
  }
  async save(grade: Grade) {
    this.store.save(grade);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemorySubjectRepository implements SubjectRepository {
  readonly store = new InMemoryStore<Subject>();
  /** Subject ids referenced by grades or assignments. */
  readonly referenced = new Set<number>();
  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: readonly number[]) {
    return byIds(this.store, ids);
  }
  async listByGrade(gradeId: number) {
    return this.store
      .all()
      .filter((s) => s.gradeId === gradeId)
      .sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '') || a.name.localeCompare(b.name));
  }
  async countByGrade() {
    const counts = new Map<number, number>();
    this.store.all().forEach((s) => counts.set(s.gradeId, (counts.get(s.gradeId) ?? 0) + 1));
    return counts;
  }
  async hasAcademicRecords(subjectId: number) {
    return this.referenced.has(subjectId);
  }
  async save(subject: Subject) {
    this.store.save(subject);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryClassroomRepository implements ClassroomRepository {
  readonly store = new InMemoryStore<Classroom>();
  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: readonly number[]) {
    return byIds(this.store, ids);
  }
  async listByYear(year: number) {
    return this.store
      .all()
      .filter((c) => c.academicYear === year)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async countByGrade(gradeId: number) {
    return this.store.all().filter((c) => c.gradeId === gradeId).length;
  }
  async save(classroom: Classroom) {
    this.store.save(classroom);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryTeachingAssignmentRepository implements TeachingAssignmentRepository {
  readonly store = new InMemoryStore<TeachingAssignment>();
  async findById(id: number) {
    return this.store.get(id);
  }
  async findOne(subjectId: number, classroomId: number, year: number) {
    return (
      this.store
        .all()
        .find((a) => a.subjectId === subjectId && a.classroomId === classroomId && a.academicYear === year) ?? null
    );
  }
  async listByClassroom(classroomId: number, year: number) {
    return this.store.all().filter((a) => a.classroomId === classroomId && a.academicYear === year);
  }
  async listByClassrooms(classroomIds: readonly number[], year: number) {
    return this.store.all().filter((a) => classroomIds.includes(a.classroomId) && a.academicYear === year);
  }
  async listByEmployee(employeeId: number, year: number) {
    return this.store.all().filter((a) => a.employeeId === employeeId && a.academicYear === year);
  }
  async countByYear(year: number) {
    return this.store.all().filter((a) => a.academicYear === year).length;
  }
  async countByClassroom(classroomId: number) {
    return this.store.all().filter((a) => a.classroomId === classroomId).length;
  }
  async save(assignment: TeachingAssignment) {
    this.store.save(assignment);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryGroupDirectorshipRepository implements GroupDirectorshipRepository {
  readonly store = new InMemoryStore<GroupDirectorship>();
  async findActiveByClassroom(classroomId: number) {
    return this.store.all().find((d) => d.classroomId === classroomId && d.isActive) ?? null;
  }
  async listActiveByClassrooms(classroomIds: readonly number[]) {
    return this.store.all().filter((d) => d.isActive && classroomIds.includes(d.classroomId));
  }
  async listActiveByEmployee(employeeId: number) {
    return this.store.all().filter((d) => d.isActive && d.employeeId === employeeId);
  }
  async save(directorship: GroupDirectorship) {
    this.store.save(directorship);
  }
}

/** Bundle of every structure fake, handy for use case tests. */
export class InMemoryStructure {
  readonly grades = new InMemoryGradeRepository();
  readonly subjects = new InMemorySubjectRepository();
  readonly classrooms = new InMemoryClassroomRepository();
  readonly assignments = new InMemoryTeachingAssignmentRepository();
  readonly directorships = new InMemoryGroupDirectorshipRepository();
}
