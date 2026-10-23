import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { indexBy } from '../../common/domain/collections.js';
import {
  STUDENT_DIRECTORY,
  type StudentDirectoryPort,
  studentDisplayName,
} from '../../common/domain/student-directory.port.js';
import { STUDENT_GRADE_REPOSITORY, type StudentGradeRepository } from '../domain/assessment.repositories.js';
import { GradingWeights } from '../domain/component-scores.js';
import { classifyPerformance } from '../domain/performance-scale.js';
import type { GradeSheetView } from './grade-sheet-view.js';
import { GradingContextService } from './grading-context.service.js';

export interface GetGradeSheetInput {
  actor: AuthenticatedActor;
  classroomId: number;
  subjectId: number;
  /** Defaults to the open period of the classroom's year. */
  periodId?: number;
}

/**
 * Active students of the classroom (by last name, first name) with their
 * grades for the subject and period. Periods other than the open one are
 * read-only.
 */
@Injectable()
export class GetGradeSheetUseCase implements UseCase<GetGradeSheetInput, GradeSheetView> {
  constructor(
    private readonly context: GradingContextService,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STUDENT_GRADE_REPOSITORY) private readonly grades: StudentGradeRepository,
  ) {}

  async execute({ actor, ...input }: GetGradeSheetInput): Promise<GradeSheetView> {
    const { classroom, subject, period } = await this.context.resolve(actor, input);
    const [students, grades] = await Promise.all([
      this.students.listActiveByClassroom(classroom.id as number),
      this.grades.listBySubjectAndPeriod(subject.id as number, period.id as number),
    ]);
    const gradeByStudent = indexBy(grades, (g) => g.studentId);
    const weights = GradingWeights.STANDARD;

    return {
      classroom: { id: classroom.id as number, name: classroom.name, academicYear: classroom.academicYear },
      subject: { id: subject.id as number, name: subject.name },
      period: { id: period.id as number, name: period.name, status: period.status },
      editable: period.isOpen,
      weights: { cognitive: weights.cognitive, procedural: weights.procedural, attitudinal: weights.attitudinal },
      rows: students.map((student) => {
        const grade = gradeByStudent.get(student.id);
        const final = grade?.finalScore;
        return {
          studentId: student.id,
          code: student.code,
          fullName: studentDisplayName(student).toUpperCase(),
          cognitive: grade?.scores.cognitive.toNumber() ?? null,
          procedural: grade?.scores.procedural.toNumber() ?? null,
          attitudinal: grade?.scores.attitudinal.toNumber() ?? null,
          finalScore: final?.toNumber() ?? null,
          passing: final ? final.isPassing() : null,
          performance: final ? classifyPerformance(final) : null,
          observations: grade?.observations ?? null,
        };
      }),
    };
  }
}
