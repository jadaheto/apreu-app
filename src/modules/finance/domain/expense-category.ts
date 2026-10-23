import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';

export interface ExpenseCategoryProps {
  name: string;
  createdAt: Date | null;
}

/** Category of an expense (`expense_categories`), e.g. "Pago de Nómina y SS". */
export class ExpenseCategory extends Entity<ExpenseCategoryProps> {
  /** Category used for payroll expenses (legacy `hr/payroll.php:31-48`). */
  static readonly PAYROLL_NAME = 'Pago de Nómina y SS';

  private constructor(id: EntityId, props: ExpenseCategoryProps) {
    super(id, props);
  }

  static create(name: string): ExpenseCategory {
    return new ExpenseCategory(null, { name: ExpenseCategory.validName(name), createdAt: null });
  }

  static restore(id: number, props: ExpenseCategoryProps): ExpenseCategory {
    return new ExpenseCategory(id, { ...props });
  }

  private static validName(name: string): string {
    const trimmed = name?.trim();
    Guard.againstEmpty(trimmed, 'nombre');
    Guard.againstMaxLength(trimmed, 150, 'nombre');
    return trimmed;
  }

  get name(): string {
    return this.props.name;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  rename(name: string): void {
    this.props.name = ExpenseCategory.validName(name);
  }
}
