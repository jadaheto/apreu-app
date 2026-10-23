import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BillingConcept, type BillingConceptData } from '../domain/billing-concept.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { toBillingConceptView, type BillingConceptView } from './views.js';

/** Creates an active billing concept (rule RN-01). */
@Injectable()
export class CreateBillingConceptUseCase implements UseCase<BillingConceptData, BillingConceptView> {
  constructor(@Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository) {}

  async execute(input: BillingConceptData): Promise<BillingConceptView> {
    const concept = BillingConcept.create(input);
    await this.concepts.save(concept);
    return toBillingConceptView(concept);
  }
}
