import { Inject, Injectable } from '@nestjs/common';
import { indexBy, unique } from '../../common/domain/collections.js';
import {
  STAFF_DIRECTORY,
  type StaffDirectoryPort,
  staffDisplayName,
} from '../../common/domain/staff-directory.port.js';
import {
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../../structure/domain/structure.repositories.js';
import { classifyPerformance } from '../domain/performance-scale.js';
import type { StudentGrade } from '../domain/student-grade.js';
import { DEFAULT_AREA, type GradeLine } from './grade-line.js';

/**
 * Turns grades into {@link GradeLine}s ordered by area and subject.
 * The teacher is looked up with a LEFT join semantic: subjects without an
 * assigned teacher are still listed and never duplicated (legacy B20 used an
 * INNER JOIN that hid or duplicated subjects).
 */
@Injectable()
export class GradeLinesService {
  constructor(
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
  ) {}

  /**
   * @param classroomId classroom whose teachers are shown (the student's
   *   current one: the schema keeps no enrollment history).
   */
  async linesFor(
    grades: readonly StudentGrade[],
    classroomId: number | null,
    academicYear: number,
  ): Promise<GradeLine[]> {
    if (grades.length === 0) return [];
    const subjects = indexBy(
      await this.subjects.findByIds(unique(grades.map((g) => g.subjectId))),
      (s) => s.id as number,
    );
    const assignments =
      classroomId === null ? [] : await this.assignments.listByClassrooms([classroomId], academicYear);
    const teacherBySubject = new Map(assignments.map((a) => [a.subjectId, a.employeeId] as const));
    const teachers = indexBy(await this.staff.findByIds(unique(teacherBySubject.values())), (m) => m.id);

    return grades
      .map((grade): GradeLine => {
        const subject = subjects.get(grade.subjectId);
        const teacher = teachers.get(teacherBySubject.get(grade.subjectId) ?? -1);
        const final = grade.finalScore;
        return {
          subjectId: grade.subjectId,
          subjectName: subject?.name ?? `Materia ${grade.subjectId}`,
          area: subject?.area ?? DEFAULT_AREA,
          teacherName: teacher ? staffDisplayName(teacher) : null,
          cognitive: grade.scores.cognitive.toNumber(),
          procedural: grade.scores.procedural.toNumber(),
          attitudinal: grade.scores.attitudinal.toNumber(),
          finalScore: final.toNumber(),
          passing: final.isPassing(),
          performance: classifyPerformance(final),
          observations: grade.observations,
        };
      })
      .sort((a, b) => a.area.localeCompare(b.area) || a.subjectName.localeCompare(b.subjectName));
  }
}
