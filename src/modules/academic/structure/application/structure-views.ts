import type { StaffMember } from '../../common/domain/staff-directory.port.js';
import { staffDisplayName } from '../../common/domain/staff-directory.port.js';
import type { EducationLevel, Grade } from '../domain/grade.js';
import type { Subject } from '../domain/subject.js';

/** Read model of a grade. */
export interface GradeView {
  id: number;
  name: string;
  level: EducationLevel;
}

/** Grade with the counters shown on the academic dashboard. */
export interface GradeSummaryView extends GradeView {
  subjectsCount: number;
  classroomsCount: number;
  studentsCount: number;
}

export interface SubjectView {
  id: number;
  gradeId: number;
  name: string;
  code: string;
  area: string | null;
  hoursPerWeek: number;
}

export interface DirectorView {
  employeeId: number;
  name: string;
  since: string;
}

export interface ClassroomView {
  id: number;
  name: string;
  gradeId: number;
  gradeName: string;
  gradeLevel: EducationLevel | null;
  capacity: number;
  academicYear: number;
  studentsCount: number;
  /** Informative: students ≥ capacity. */
  isFull: boolean;
  director: DirectorView | null;
}

export interface TeacherView {
  id: number;
  code: string;
  name: string;
  employeeType: string;
}

export const toGradeView = (grade: Grade): GradeView => ({
  id: grade.id as number,
  name: grade.name,
  level: grade.level,
});

export const toSubjectView = (subject: Subject): SubjectView => ({
  id: subject.id as number,
  gradeId: subject.gradeId,
  name: subject.name,
  code: subject.code,
  area: subject.area,
  hoursPerWeek: subject.hoursPerWeek,
});

export const toTeacherView = (member: StaffMember): TeacherView => ({
  id: member.id,
  code: member.code,
  name: staffDisplayName(member),
  employeeType: member.employeeType,
});
