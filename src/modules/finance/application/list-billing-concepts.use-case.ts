import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { toBillingConceptView, type BillingConceptView } from './views.js';

/** Lists billing concepts, optionally only active or inactive ones (legacy `settings.php?tab=billing`). */
@Injectable()
export class ListBillingConceptsUseCase implements UseCase<{ active?: boolean }, BillingConceptView[]> {
  constructor(@Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository) {}

  async execute(filter: { active?: boolean }): Promise<BillingConceptView[]> {
    return (await this.concepts.list(filter)).map(toBillingConceptView);
  }
}
