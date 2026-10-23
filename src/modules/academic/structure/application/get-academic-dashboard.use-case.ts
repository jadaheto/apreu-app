import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  GRADE_REPOSITORY,
  type GradeRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';
import { ClassroomOverviewService } from './classroom-overview.service.js';
import { toGradeView, type ClassroomView, type GradeSummaryView } from './structure-views.js';

export interface AcademicDashboardView {
  academicYear: number;
  totals: { grades: number; classrooms: number; teachingAssignments: number };
  grades: GradeSummaryView[];
  classrooms: ClassroomView[];
}

/**
 * KPIs and lists of the academic management page (legacy `academic/index.php`).
 * Student counts per grade only include the classrooms of the selected year
 * (the legacy counted any year: B26).
 */
@Injectable()
export class GetAcademicDashboardUseCase implements UseCase<{ year?: number }, AcademicDashboardView> {
  constructor(
    @Inject(GRADE_REPOSITORY) private readonly grades: GradeRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    private readonly overview: ClassroomOverviewService,
  ) {}

  async execute({ year }: { year?: number }): Promise<AcademicDashboardView> {
    const academicYear = year ?? (await this.settings.currentAcademicYear());
    const [grades, subjectCounts, classrooms, teachingAssignments] = await Promise.all([
      this.grades.listAll(),
      this.subjects.countByGrade(),
      this.classrooms.listByYear(academicYear),
      this.assignments.countByYear(academicYear),
    ]);
    const classroomViews = await this.overview.describe(classrooms);

    return {
      academicYear,
      totals: { grades: grades.length, classrooms: classrooms.length, teachingAssignments },
      grades: grades.map((grade) => {
        const ofGrade = classroomViews.filter((c) => c.gradeId === grade.id);
        return {
          ...toGradeView(grade),
          subjectsCount: subjectCounts.get(grade.id as number) ?? 0,
          classroomsCount: ofGrade.length,
          studentsCount: ofGrade.reduce((sum, c) => sum + c.studentsCount, 0),
        };
      }),
      classrooms: classroomViews,
    };
  }
}
