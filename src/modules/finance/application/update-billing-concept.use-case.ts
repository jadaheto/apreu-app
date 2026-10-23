import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { BillingConceptData } from '../domain/billing-concept.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { toBillingConceptView, type BillingConceptView } from './views.js';

export interface UpdateBillingConceptInput extends BillingConceptData {
  id: number;
}

/** Edits a billing concept. Existing charges keep the amounts they were generated with. */
@Injectable()
export class UpdateBillingConceptUseCase implements UseCase<UpdateBillingConceptInput, BillingConceptView> {
  constructor(@Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository) {}

  async execute({ id, ...data }: UpdateBillingConceptInput): Promise<BillingConceptView> {
    const concept = await this.concepts.findById(id);
    if (!concept) throw new NotFoundError('Concepto de cobro', id);
    concept.update(data);
    await this.concepts.save(concept);
    return toBillingConceptView(concept);
  }
}
