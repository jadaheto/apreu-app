import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ChargeBatchPlanner, type BatchRequest, type ChargeBatchSummary } from './charge-batch-planner.js';

/** Shows how many charges a batch would create, their amounts and the duplicates skipped, without saving. */
@Injectable()
export class PreviewChargeBatchUseCase implements UseCase<BatchRequest, ChargeBatchSummary> {
  constructor(private readonly planner: ChargeBatchPlanner) {}

  async execute(request: BatchRequest): Promise<ChargeBatchSummary> {
    return ChargeBatchPlanner.summarize(await this.planner.planBatch(request));
  }
}
