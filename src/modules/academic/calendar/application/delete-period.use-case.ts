import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { ACADEMIC_PERIOD_REPOSITORY, type AcademicPeriodRepository } from '../domain/academic-period.repository.js';

/**
 * Deletes a period without grades (legacy action `delete_period`); its report
 * cards are removed by the database cascade.
 */
@Injectable()
export class DeletePeriodUseCase implements UseCase<number, void> {
  constructor(@Inject(ACADEMIC_PERIOD_REPOSITORY) private readonly periods: AcademicPeriodRepository) {}

  async execute(periodId: number): Promise<void> {
    const period = requireFound(await this.periods.findById(periodId), 'Período académico', periodId);
    if (await this.periods.hasGrades(periodId)) {
      throw new ConflictError(`El período "${period.name}" tiene calificaciones registradas y no se puede eliminar.`);
    }
    await this.periods.delete(periodId);
  }
}
