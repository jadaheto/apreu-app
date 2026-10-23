import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { GRADE_CATALOG, type GradeCatalogPort } from '../domain/grade-catalog.port.js';
import { TuitionSchedule } from '../domain/tuition-schedule.js';
import { TUITION_SCHEDULE_REPOSITORY, type TuitionScheduleRepository } from '../domain/tuition-schedule.repository.js';
import { toTuitionScheduleView, type TuitionScheduleView } from './tuition-schedule-view.js';

export interface SaveTuitionScheduleInput {
  academicYear: number;
  rates: { gradeId: number; conceptId: number | null; amount: number }[];
}

/**
 * Replaces every tuition rate of a year atomically (legacy deleted and
 * re-inserted without a transaction, bug B49). Grades and concepts must exist.
 */
@Injectable()
export class SaveTuitionScheduleUseCase implements UseCase<SaveTuitionScheduleInput, TuitionScheduleView> {
  constructor(
    @Inject(TUITION_SCHEDULE_REPOSITORY) private readonly schedules: TuitionScheduleRepository,
    @Inject(GRADE_CATALOG) private readonly grades: GradeCatalogPort,
    @Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: SaveTuitionScheduleInput): Promise<TuitionScheduleView> {
    const schedule = TuitionSchedule.create(input.academicYear, input.rates);

    const gradeIds = schedule.gradeIds();
    const existingGrades = new Set(await this.grades.existingIds(gradeIds));
    const unknownGrades = gradeIds.filter((id) => !existingGrades.has(id));
    if (unknownGrades.length > 0) {
      throw new BusinessRuleViolationError('Hay tarifas con grados inexistentes.', 'UNKNOWN_GRADE', {
        gradeIds: unknownGrades,
      });
    }

    const conceptIds = schedule.conceptIds();
    const existingConcepts = new Set((await this.concepts.findByIds(conceptIds)).map((concept) => concept.id));
    const unknownConcepts = conceptIds.filter((id) => !existingConcepts.has(id));
    if (unknownConcepts.length > 0) {
      throw new BusinessRuleViolationError('Hay tarifas con conceptos inexistentes.', 'UNKNOWN_CONCEPT', {
        conceptIds: unknownConcepts,
      });
    }

    await this.uow.runInTransaction(() => this.schedules.replace(schedule));
    return toTuitionScheduleView(schedule);
  }
}
