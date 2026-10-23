import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { ChargeBatchPlanner, type BatchRequest, type ChargeBatchSummary } from './charge-batch-planner.js';

/**
 * Generates the charges of a concept for every active student (optionally of
 * one grade) in a single transaction (legacy batch was not atomic, bug B11).
 * Idempotent per (student, concept, period).
 */
@Injectable()
export class GenerateChargeBatchUseCase implements UseCase<BatchRequest, ChargeBatchSummary> {
  constructor(
    private readonly planner: ChargeBatchPlanner,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(request: BatchRequest): Promise<ChargeBatchSummary> {
    return this.uow.runInTransaction(async () => {
      const plan = await this.planner.planBatch(request);
      await this.charges.saveMany(plan.charges);
      return ChargeBatchPlanner.summarize(plan);
    });
  }
}
