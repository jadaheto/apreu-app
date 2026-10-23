import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  PAYROLL_NOVELTY_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollNoveltyRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { loadPeriod } from './load-period.js';

export interface RemovePayrollNoveltyInput {
  periodId: number;
  noveltyId: number;
}

/** Removes a novelty from an editable period; the period must be recalculated. */
@Injectable()
export class RemovePayrollNoveltyUseCase implements UseCase<RemovePayrollNoveltyInput, void> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_NOVELTY_REPOSITORY) private readonly novelties: PayrollNoveltyRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  execute({ periodId, noveltyId }: RemovePayrollNoveltyInput): Promise<void> {
    return this.uow.runInTransaction(async () => {
      const period = await loadPeriod(this.periods, periodId);
      const novelty = await this.novelties.findById(noveltyId);
      if (!novelty || novelty.periodId !== periodId) throw new NotFoundError('Novedad de nómina', noveltyId);
      period.invalidateCalculation();
      await this.novelties.delete(noveltyId);
      await this.periods.save(period);
    });
  }
}
