import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ACADEMIC_SETTINGS, type AcademicSettingsPort } from '../../common/domain/academic-settings.port.js';
import { requireFound } from '../../common/domain/require-found.js';
import { studentDisplayName } from '../../common/domain/student-directory.port.js';
import type { PeriodStatus } from '../../calendar/domain/academic-period.js';
import {
  ACADEMIC_PERIOD_REPOSITORY,
  type AcademicPeriodRepository,
} from '../../calendar/domain/academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { STUDENT_GRADE_REPOSITORY, type StudentGradeRepository } from '../domain/assessment.repositories.js';
import { classifyAverage, type Performance } from '../domain/performance-scale.js';
import { averageOf, isPassingAverage } from '../domain/score.js';
import type { GradeLine } from './grade-line.js';
import { GradeLinesService } from './grade-lines.service.js';

export interface GetStudentGradesInput {
  actor: AuthenticatedActor;
  studentId: number;
  /** Defaults to the latest period of the current year with grades. */
  periodId?: number;
}

export interface StudentGradesView {
  student: { id: number; code: string; fullName: string };
  academicYear: number;
  /** Periods of the year in which the student has grades. */
  periods: { id: number; name: string; status: PeriodStatus }[];
  selectedPeriodId: number | null;
  lines: GradeLine[];
  average: number | null;
  averagePerformance: Performance | null;
  passing: boolean | null;
}

/**
 * Grades of a student per period with performance level and average
 * (legacy `student/mis_notas.php`, which filtered by the never-written
 * `period` column: B7). Readable by admins, the student, their guardians, the
 * group director and the classroom's teachers.
 */
@Injectable()
export class GetStudentGradesUseCase implements UseCase<GetStudentGradesInput, StudentGradesView> {
  constructor(
    private readonly access: AcademicAccessService,
    @Inject(STUDENT_GRADE_REPOSITORY) private readonly grades: StudentGradeRepository,
    @Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository,
    @Inject(ACADEMIC_SETTINGS) private readonly settings: AcademicSettingsPort,
    private readonly gradeLines: GradeLinesService,
  ) {}

  async execute({ actor, studentId, periodId }: GetStudentGradesInput): Promise<StudentGradesView> {
    const student = await this.access.readableStudent(actor, studentId, 'grades');
    const requested =
      periodId === undefined
        ? null
        : requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    const academicYear = requested?.academicYear ?? (await this.settings.currentAcademicYear());

    const [grades, periodsOfYear] = await Promise.all([
      this.grades.listByStudentAndYear(studentId, academicYear),
      this.periods.listByYear(academicYear),
    ]);
    const graded = periodsOfYear.filter((p) => grades.some((g) => g.periodId === p.id));
    const selected = requested ?? graded.at(-1) ?? null;
    const selectedGrades = selected ? grades.filter((g) => g.periodId === selected.id) : [];
    const average = averageOf(selectedGrades.map((g) => g.finalScore));

    return {
      student: { id: student.id, code: student.code, fullName: studentDisplayName(student) },
      academicYear,
      periods: graded.map((p) => ({ id: p.id as number, name: p.name, status: p.status })),
      selectedPeriodId: selected ? (selected.id as number) : null,
      lines: await this.gradeLines.linesFor(selectedGrades, student.classroomId, academicYear),
      average,
      averagePerformance: average === null ? null : classifyAverage(average),
      passing: average === null ? null : isPassingAverage(average),
    };
  }
}
