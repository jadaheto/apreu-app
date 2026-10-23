import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { indexBy } from '../../common/domain/collections.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../../common/domain/student-directory.port.js';
import { PeriodCalendar } from '../../calendar/domain/period-calendar.js';
import { STUDENT_GRADE_REPOSITORY, type StudentGradeRepository } from '../domain/assessment.repositories.js';
import { ComponentScores } from '../domain/component-scores.js';
import { StudentGrade } from '../domain/student-grade.js';
import { GradingContextService } from './grading-context.service.js';

export interface GradeSheetEntry {
  studentId: number;
  cognitive?: number | null;
  procedural?: number | null;
  attitudinal?: number | null;
  observations?: string | null;
}

export interface SaveGradeSheetInput {
  actor: AuthenticatedActor;
  classroomId: number;
  subjectId: number;
  /** Must be the open period (legacy B13 silently saved into the open one). */
  periodId: number;
  entries: GradeSheetEntry[];
}

/**
 * Upserts the grades of a sheet in one transaction (legacy
 * `academic/grades_entry.php` POST). Rules: the period must be open (rule 18),
 * the actor must teach the subject in the classroom (S4), each student must be
 * active in the classroom, scores are 0.0–5.0 and the final is weighted
 * 60/30/10. Grades are keyed by `period_id` and the legacy NOT NULL `period`
 * column is filled with the period's ordinal (fixes B1).
 */
@Injectable()
export class SaveGradeSheetUseCase implements UseCase<SaveGradeSheetInput, { saved: number }> {
  constructor(
    private readonly context: GradingContextService,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(STUDENT_GRADE_REPOSITORY) private readonly grades: StudentGradeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute({ actor, entries, ...input }: SaveGradeSheetInput): Promise<{ saved: number }> {
    const { classroom, subject, period, periodsOfYear } = await this.context.resolve(actor, input);
    if (!period.isOpen) {
      throw new BusinessRuleViolationError(
        `Solo se pueden guardar notas en el período abierto; "${period.name}" está ${period.status}.`,
        'PERIOD_NOT_OPEN',
      );
    }
    this.assertNoDuplicates(entries);
    const roster = indexBy(await this.students.listActiveByClassroom(classroom.id as number), (s) => s.id);
    const outsiders = entries.filter((entry) => !roster.has(entry.studentId)).map((entry) => entry.studentId);
    if (outsiders.length > 0) {
      throw new BusinessRuleViolationError(
        'Algunos estudiantes no pertenecen a este salón o no están activos.',
        'STUDENT_NOT_IN_CLASSROOM',
        { studentIds: outsiders },
      );
    }

    const periodId = period.id as number;
    const periodNumber = PeriodCalendar.ordinalOf(period, periodsOfYear);
    return this.uow.runInTransaction(async () => {
      const existing = indexBy(
        await this.grades.listBySubjectAndPeriod(subject.id as number, periodId),
        (g) => g.studentId,
      );
      const toSave = entries.map((entry) => {
        const scores = ComponentScores.of(entry);
        const current = existing.get(entry.studentId);
        if (current) {
          current.regrade(scores, entry.observations, periodNumber);
          return current;
        }
        return StudentGrade.record({
          studentId: entry.studentId,
          subjectId: subject.id as number,
          periodId,
          academicYear: classroom.academicYear,
          periodNumber,
          scores,
          observations: entry.observations,
        });
      });
      await this.grades.saveAll(toSave);
      return { saved: toSave.length };
    });
  }

  private assertNoDuplicates(entries: readonly GradeSheetEntry[]): void {
    const ids = entries.map((entry) => entry.studentId);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleViolationError(
        'Un estudiante aparece más de una vez en la planilla.',
        'DUPLICATED_STUDENT',
      );
    }
  }
}
