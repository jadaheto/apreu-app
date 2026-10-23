import type { BillingConcept } from './billing-concept.js';

/** Output port for {@link BillingConcept} persistence. */
export interface BillingConceptRepository {
  findById(id: number): Promise<BillingConcept | null>;
  findByIds(ids: number[]): Promise<BillingConcept[]>;
  /** Ordered like the legacy screen: active first, then category and name. */
  list(filter: { active?: boolean }): Promise<BillingConcept[]>;
  save(concept: BillingConcept): Promise<void>;
}

export const BILLING_CONCEPT_REPOSITORY = Symbol('BillingConceptRepository');
