import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { indexBy, unique } from '../../common/domain/collections.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../../structure/domain/structure.repositories.js';

export interface MyTeachingAssignmentView {
  assignmentId: number;
  academicYear: number;
  classroom: { id: number; name: string; gradeName: string };
  subject: { id: number; name: string; area: string | null; hoursPerWeek: number };
  studentsCount: number;
}

/**
 * Groups and subjects of the signed-in teacher for a year (legacy
 * `employee/my_groups.php`, broken by the non-existent `student_enrollments`
 * table: B11, and unfiltered by year: B28). The teacher comes from the token.
 */
@Injectable()
export class ListMyTeachingAssignmentsUseCase implements UseCase<
  { actor: AuthenticatedActor; year?: number },
  MyTeachingAssignmentView[]
> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
  ) {}

  async execute({ actor, year }: { actor: AuthenticatedActor; year?: number }): Promise<MyTeachingAssignmentView[]> {
    const employee = await this.access.requireEmployee(actor);
    const academicYear = year ?? (await this.settings.currentAcademicYear());
    const assignments = await this.assignments.listByEmployee(employee.id, academicYear);
    if (assignments.length === 0) return [];

    const classroomIds = unique(assignments.map((a) => a.classroomId));
    const [classrooms, subjects, counts] = await Promise.all([
      this.classrooms.findByIds(classroomIds),
      this.subjects.findByIds(unique(assignments.map((a) => a.subjectId))),
      this.students.countActiveByClassroom(classroomIds),
    ]);
    const grades = indexBy(
      await this.grades.findByIds(unique(classrooms.map((c) => c.gradeId))),
      (g) => g.id as number,
    );
    const classroomById = indexBy(classrooms, (c) => c.id as number);
    const subjectById = indexBy(subjects, (s) => s.id as number);

    return assignments
      .flatMap((assignment): MyTeachingAssignmentView[] => {
        const classroom = classroomById.get(assignment.classroomId);
        const subject = subjectById.get(assignment.subjectId);
        if (!classroom || !subject) return [];
        return [
          {
            assignmentId: assignment.id as number,
            academicYear: assignment.academicYear,
            classroom: {
              id: assignment.classroomId,
              name: classroom.name,
              gradeName: grades.get(classroom.gradeId)?.name ?? '',
            },
            subject: {
              id: assignment.subjectId,
              name: subject.name,
              area: subject.area,
              hoursPerWeek: subject.hoursPerWeek,
            },
            studentsCount: counts.get(assignment.classroomId) ?? 0,
          },
        ];
      })
      .sort((a, b) => a.classroom.name.localeCompare(b.classroom.name) || a.subject.name.localeCompare(b.subject.name));
  }
}
