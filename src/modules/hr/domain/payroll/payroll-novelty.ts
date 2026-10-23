import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';

/**
 * One-off payroll novelties. Earnings: overtime (amount already valued by
 * HR), salary and non-salary bonuses. Deductions: libranza, cuota sindical,
 * embargo and other deductions (the legacy modal supported the last three).
 */
export const NOVELTY_TYPES = [
  'overtime',
  'bonus_salary',
  'bonus_non_salary',
  'libranza',
  'sindicato',
  'embargo',
  'other_deduction',
] as const;
export type NoveltyType = (typeof NOVELTY_TYPES)[number];

export interface PayrollNoveltyProps {
  periodId: number;
  employeeId: number;
  type: NoveltyType;
  amount: Money;
  description: string | null;
  createdBy: number | null;
  createdAt: Date | null;
}

export interface NewPayrollNovelty {
  periodId: number;
  employeeId: number;
  type: NoveltyType;
  amount: number;
  description?: string | null;
  createdBy: number;
}

/**
 * A novelty registered for one employee in one payroll period
 * (`payroll_novelties`). Amounts are taken as entered for the period; unlike
 * recurring deductions they are not prorated (the legacy did the same
 * without telling the user, B-15; the API documents it).
 */
export class PayrollNovelty extends Entity<PayrollNoveltyProps> {
  private constructor(id: EntityId, props: PayrollNoveltyProps) {
    super(id, props);
  }

  static create(input: NewPayrollNovelty): PayrollNovelty {
    Guard.oneOf(input.type, NOVELTY_TYPES, 'tipo de novedad');
    const amount = Money.of(input.amount);
    if (!amount.isGreaterThan(Money.zero())) {
      throw new BusinessRuleViolationError('El valor de la novedad debe ser mayor que cero.', 'INVALID_AMOUNT');
    }
    const description = input.description?.trim() || null;
    Guard.againstMaxLength(description, 255, 'descripción');
    return new PayrollNovelty(null, {
      periodId: input.periodId,
      employeeId: input.employeeId,
      type: input.type,
      amount,
      description,
      createdBy: input.createdBy,
      createdAt: null,
    });
  }

  static restore(id: number, props: PayrollNoveltyProps): PayrollNovelty {
    return new PayrollNovelty(id, { ...props });
  }

  get periodId(): number {
    return this.props.periodId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get type(): NoveltyType {
    return this.props.type;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get description(): string | null {
    return this.props.description;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
