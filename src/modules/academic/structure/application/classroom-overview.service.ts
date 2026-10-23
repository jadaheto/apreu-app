import { Inject, Injectable } from '@nestjs/common';
import { indexBy, unique } from '../../common/domain/collections.js';
import {
  STAFF_DIRECTORY,
  type StaffDirectoryPort,
  staffDisplayName,
} from '../../common/domain/staff-directory.port.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import type { Classroom } from '../domain/classroom.js';
import {
  GRADE_REPOSITORY,
  type GradeRepository,
  GROUP_DIRECTORSHIP_REPOSITORY,
  type GroupDirectorshipRepository,
} from '../domain/structure.repositories.js';
import type { ClassroomView } from './structure-views.js';

/**
 * Builds {@link ClassroomView}s (grade, active student count, current director)
 * with batched lookups — legacy `academic/index.php:123-134` did it per row.
 */
@Injectable()
export class ClassroomOverviewService {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(GROUP_DIRECTORSHIP_REPOSITORY) private readonly directorships: GroupDirectorshipRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
  ) {}

  async describe(classrooms: readonly Classroom[]): Promise<ClassroomView[]> {
    if (classrooms.length === 0) return [];
    const classroomIds = classrooms.map((c) => c.id as number);
    const [grades, counts, directorships] = await Promise.all([
      this.grades.findByIds(unique(classrooms.map((c) => c.gradeId))),
      this.students.countActiveByClassroom(classroomIds),
      this.directorships.listActiveByClassrooms(classroomIds),
    ]);
    const directors = indexBy(await this.staff.findByIds(unique(directorships.map((d) => d.employeeId))), (m) => m.id);
    const gradeById = indexBy(grades, (g) => g.id as number);
    const directorshipByClassroom = indexBy(directorships, (d) => d.classroomId);

    return classrooms.map((classroom) => {
      const id = classroom.id as number;
      const grade = gradeById.get(classroom.gradeId);
      const studentsCount = counts.get(id) ?? 0;
      const directorship = directorshipByClassroom.get(id);
      const director = directorship ? directors.get(directorship.employeeId) : undefined;
      return {
        id,
        name: classroom.name,
        gradeId: classroom.gradeId,
        gradeName: grade?.name ?? '',
        gradeLevel: grade?.level ?? null,
        capacity: classroom.capacity,
        academicYear: classroom.academicYear,
        studentsCount,
        isFull: classroom.isFullWith(studentsCount),
        director:
          directorship && director
            ? { employeeId: director.id, name: staffDisplayName(director), since: directorship.assignedOn }
            : null,
      };
    });
  }
}
