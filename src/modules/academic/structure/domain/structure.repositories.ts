import type { Classroom } from './classroom.js';
import type { Grade } from './grade.js';
import type { GroupDirectorship } from './group-directorship.js';
import type { Subject } from './subject.js';
import type { TeachingAssignment } from './teaching-assignment.js';

/** Output port for {@link Grade} (`grades`). */
export interface GradeRepository {
  findById(id: number): Promise<Grade | null>;
  findByIds(ids: readonly number[]): Promise<Grade[]>;
  /** Ordered by level (preescolar → media) and name. */
  listAll(): Promise<Grade[]>;
  save(grade: Grade): Promise<void>;
  delete(id: number): Promise<void>;
}

/** Output port for {@link Subject} (`subjects`). */
export interface SubjectRepository {
  findById(id: number): Promise<Subject | null>;
  findByIds(ids: readonly number[]): Promise<Subject[]>;
  /** Ordered by area and name. */
  listByGrade(gradeId: number): Promise<Subject[]>;
  /** Number of subjects per grade id. */
  countByGrade(): Promise<Map<number, number>>;
  /** True when grades or teaching assignments reference the subject. */
  hasAcademicRecords(subjectId: number): Promise<boolean>;
  save(subject: Subject): Promise<void>;
  delete(id: number): Promise<void>;
}

/** Output port for {@link Classroom} (`classrooms`). */
export interface ClassroomRepository {
  findById(id: number): Promise<Classroom | null>;
  findByIds(ids: readonly number[]): Promise<Classroom[]>;
  /** Classrooms of a year ordered by name. */
  listByYear(year: number): Promise<Classroom[]>;
  /** Classrooms of a grade in any year. */
  countByGrade(gradeId: number): Promise<number>;
  save(classroom: Classroom): Promise<void>;
  delete(id: number): Promise<void>;
}

/** Output port for {@link TeachingAssignment} (`teacher_assignments`). */
export interface TeachingAssignmentRepository {
  findById(id: number): Promise<TeachingAssignment | null>;
  findOne(subjectId: number, classroomId: number, year: number): Promise<TeachingAssignment | null>;
  listByClassroom(classroomId: number, year: number): Promise<TeachingAssignment[]>;
  /** Assignments of several classrooms for a year (report cards, teacher names). */
  listByClassrooms(classroomIds: readonly number[], year: number): Promise<TeachingAssignment[]>;
  listByEmployee(employeeId: number, year: number): Promise<TeachingAssignment[]>;
  countByYear(year: number): Promise<number>;
  countByClassroom(classroomId: number): Promise<number>;
  save(assignment: TeachingAssignment): Promise<void>;
  delete(id: number): Promise<void>;
}

/** Output port for {@link GroupDirectorship} (`group_directors`). */
export interface GroupDirectorshipRepository {
  findActiveByClassroom(classroomId: number): Promise<GroupDirectorship | null>;
  listActiveByClassrooms(classroomIds: readonly number[]): Promise<GroupDirectorship[]>;
  listActiveByEmployee(employeeId: number): Promise<GroupDirectorship[]>;
  save(directorship: GroupDirectorship): Promise<void>;
}

export const GRADE_REPOSITORY = Symbol('GradeRepository');
export const SUBJECT_REPOSITORY = Symbol('SubjectRepository');
export const CLASSROOM_REPOSITORY = Symbol('ClassroomRepository');
export const TEACHING_ASSIGNMENT_REPOSITORY = Symbol('TeachingAssignmentRepository');
export const GROUP_DIRECTORSHIP_REPOSITORY = Symbol('GroupDirectorshipRepository');
