import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { BILLING_CONCEPT_REPOSITORY, type BillingConceptRepository } from '../domain/billing-concept.repository.js';
import { toBillingConceptView, type BillingConceptView } from './views.js';

/** Activates or deactivates a concept; concepts are never deleted (rule RN-02). */
@Injectable()
export class SetBillingConceptActiveUseCase implements UseCase<{ id: number; active: boolean }, BillingConceptView> {
  constructor(@Inject(BILLING_CONCEPT_REPOSITORY) private readonly concepts: BillingConceptRepository) {}

  async execute({ id, active }: { id: number; active: boolean }): Promise<BillingConceptView> {
    const concept = await this.concepts.findById(id);
    if (!concept) throw new NotFoundError('Concepto de cobro', id);
    if (active) concept.activate();
    else concept.deactivate();
    await this.concepts.save(concept);
    return toBillingConceptView(concept);
  }
}
