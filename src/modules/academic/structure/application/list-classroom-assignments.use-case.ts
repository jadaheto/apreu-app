import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { indexBy, unique } from '../../common/domain/collections.js';
import { requireFound } from '../../common/domain/require-found.js';
import { STAFF_DIRECTORY, type StaffDirectoryPort } from '../../common/domain/staff-directory.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';
import { ClassroomOverviewService } from './classroom-overview.service.js';
import {
  toSubjectView,
  toTeacherView,
  type ClassroomView,
  type SubjectView,
  type TeacherView,
} from './structure-views.js';

export interface TeachingLoadLine {
  subject: SubjectView;
  /** `null` when the subject still has no teacher (highlighted in the UI). */
  assignmentId: number | null;
  teacher: TeacherView | null;
}

export interface ClassroomTeachingLoadView {
  classroom: ClassroomView;
  lines: TeachingLoadLine[];
}

/**
 * Teaching load of a classroom: every subject of its grade with the assigned
 * teacher, if any (legacy `academic/assignments.php`).
 */
@Injectable()
export class ListClassroomAssignmentsUseCase implements UseCase<number, ClassroomTeachingLoadView> {
  constructor(
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute(classroomId: number): Promise<ClassroomTeachingLoadView> {
    const classroom = requireFound(await this.classrooms.findById(classroomId), 'Salón', classroomId);
    const [subjects, assignments, [view]] = await Promise.all([
      this.subjects.listByGrade(classroom.gradeId),
      this.assignments.listByClassroom(classroomId, classroom.academicYear),
      this.overview.describe([classroom]),
    ]);
    const teachers = indexBy(await this.staff.findByIds(unique(assignments.map((a) => a.employeeId))), (m) => m.id);
    const assignmentBySubject = indexBy(assignments, (a) => a.subjectId);

    return {
      classroom: view,
      lines: subjects.map((subject) => {
        const assignment = assignmentBySubject.get(subject.id as number);
        const teacher = assignment ? teachers.get(assignment.employeeId) : undefined;
        return {
          subject: toSubjectView(subject),
          assignmentId: assignment ? (assignment.id as number) : null,
          teacher: teacher ? toTeacherView(teacher) : null,
        };
      }),
    };
  }
}
