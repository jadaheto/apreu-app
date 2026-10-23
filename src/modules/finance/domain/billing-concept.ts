import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { CONCEPT_CATEGORIES, type ConceptCategory } from './concept-category.js';
import { TaxRate } from './tax-rate.vo.js';

export interface BillingConceptProps {
  name: string;
  description: string | null;
  code: string | null;
  category: ConceptCategory;
  amount: Money;
  taxRate: TaxRate;
  isActive: boolean;
  createdAt: Date | null;
}

export interface BillingConceptData {
  name: string;
  description?: string | null;
  code?: string | null;
  category?: ConceptCategory;
  amount: number;
  taxRate?: number;
}

/**
 * Billable concept (tuition, enrollment, certificate…), table `billing_concepts`.
 * Legacy `settings.php?tab=billing`.
 *
 * Rules RN-01/RN-02: name required, `amount ≥ 0`, `0 ≤ taxRate ≤ 100`, code
 * optional and not unique; concepts are never deleted, only deactivated.
 */
export class BillingConcept extends Entity<BillingConceptProps> {
  private constructor(id: EntityId, props: BillingConceptProps) {
    super(id, props);
  }

  static create(data: BillingConceptData): BillingConcept {
    return new BillingConcept(null, { ...BillingConcept.validate(data), isActive: true, createdAt: null });
  }

  static restore(id: number, props: BillingConceptProps): BillingConcept {
    return new BillingConcept(id, { ...props });
  }

  private static validate(data: BillingConceptData) {
    const name = data.name?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 200, 'nombre');
    const description = data.description?.trim() || null;
    Guard.againstMaxLength(description, 255, 'descripción');
    const code = data.code?.trim().toUpperCase() || null;
    Guard.againstMaxLength(code, 30, 'código');
    const category = data.category ?? 'pension';
    Guard.oneOf(category, CONCEPT_CATEGORIES, 'categoría');
    const amount = Money.of(data.amount);
    Guard.againstNegative(amount.amount, 'monto');
    return { name, description, code, category, amount, taxRate: TaxRate.of(data.taxRate ?? 0) };
  }

  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get code(): string | null {
    return this.props.code;
  }
  get category(): ConceptCategory {
    return this.props.category;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get taxRate(): TaxRate {
    return this.props.taxRate;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** Certificate concepts trigger the issuance of a certificate once paid (RN-17). */
  get isCertificate(): boolean {
    return this.props.category === 'certificado';
  }

  update(data: BillingConceptData): void {
    Object.assign(this.props, BillingConcept.validate(data));
  }

  activate(): void {
    this.props.isActive = true;
  }

  deactivate(): void {
    this.props.isActive = false;
  }
}
