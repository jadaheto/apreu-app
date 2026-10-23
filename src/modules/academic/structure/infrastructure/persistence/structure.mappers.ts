import { toIsoDate } from '../../../common/infrastructure/orm-support.js';
import { Classroom } from '../../domain/classroom.js';
import { Grade, type EducationLevel } from '../../domain/grade.js';
import { GroupDirectorship } from '../../domain/group-directorship.js';
import { Subject } from '../../domain/subject.js';
import { TeachingAssignment } from '../../domain/teaching-assignment.js';
import {
  ClassroomOrmEntity,
  GradeOrmEntity,
  GroupDirectorOrmEntity,
  SubjectOrmEntity,
  TeacherAssignmentOrmEntity,
} from './structure.orm-entities.js';

/** Copies the id of persisted aggregates onto a new ORM row. */
const withId = <T extends { id: number }>(row: T, id: number | null): T => {
  if (id !== null) row.id = id;
  return row;
};

/** Row ↔ aggregate translation for the structure tables. */
export const StructureMapper = {
  // Legacy `level` is free text: unknown values are kept as-is for display.
  toGrade: (row: GradeOrmEntity): Grade =>
    Grade.restore(row.id, { name: row.name, level: row.level as EducationLevel }),

  fromGrade: (grade: Grade): GradeOrmEntity =>
    Object.assign(withId(new GradeOrmEntity(), grade.id), { name: grade.name, level: grade.level }),

  toSubject: (row: SubjectOrmEntity): Subject =>
    Subject.restore(row.id, {
      gradeId: row.gradeId,
      name: row.name,
      code: row.code,
      area: row.area,
      hoursPerWeek: row.hoursPerWeek,
    }),

  fromSubject: (subject: Subject): SubjectOrmEntity =>
    Object.assign(withId(new SubjectOrmEntity(), subject.id), {
      gradeId: subject.gradeId,
      name: subject.name,
      code: subject.code,
      area: subject.area,
      hoursPerWeek: subject.hoursPerWeek,
    }),

  toClassroom: (row: ClassroomOrmEntity): Classroom =>
    Classroom.restore(row.id, {
      gradeId: row.gradeId,
      name: row.name,
      capacity: row.capacity,
      academicYear: Number(row.academicYear),
    }),

  fromClassroom: (classroom: Classroom): ClassroomOrmEntity =>
    Object.assign(withId(new ClassroomOrmEntity(), classroom.id), {
      gradeId: classroom.gradeId,
      name: classroom.name,
      capacity: classroom.capacity,
      academicYear: classroom.academicYear,
    }),

  toAssignment: (row: TeacherAssignmentOrmEntity): TeachingAssignment =>
    TeachingAssignment.restore(row.id, {
      employeeId: row.employeeId,
      subjectId: row.subjectId,
      classroomId: row.classroomId,
      academicYear: Number(row.academicYear),
    }),

  fromAssignment: (assignment: TeachingAssignment): TeacherAssignmentOrmEntity =>
    Object.assign(withId(new TeacherAssignmentOrmEntity(), assignment.id), {
      employeeId: assignment.employeeId,
      subjectId: assignment.subjectId,
      classroomId: assignment.classroomId,
      academicYear: assignment.academicYear,
    }),

  toDirectorship: (row: GroupDirectorOrmEntity): GroupDirectorship =>
    GroupDirectorship.restore(row.id, {
      classroomId: row.classroomId,
      employeeId: row.employeeId,
      assignedOn: row.assignmentDate ? toIsoDate(row.assignmentDate) : toIsoDate(row.createdAt ?? new Date(0)),
      isActive: row.isActive,
    }),

  fromDirectorship: (directorship: GroupDirectorship): GroupDirectorOrmEntity =>
    Object.assign(withId(new GroupDirectorOrmEntity(), directorship.id), {
      classroomId: directorship.classroomId,
      employeeId: directorship.employeeId,
      assignmentDate: directorship.assignedOn,
      isActive: directorship.isActive,
    }),
};
