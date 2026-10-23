import type { TeachingAssignment } from '../domain/teaching-assignment.js';

/** Read model of a teaching assignment. */
export interface TeachingAssignmentView {
  id: number;
  employeeId: number;
  subjectId: number;
  classroomId: number;
  academicYear: number;
}

export const toAssignmentView = (assignment: TeachingAssignment): TeachingAssignmentView => ({
  id: assignment.id as number,
  employeeId: assignment.employeeId,
  subjectId: assignment.subjectId,
  classroomId: assignment.classroomId,
  academicYear: assignment.academicYear,
});
