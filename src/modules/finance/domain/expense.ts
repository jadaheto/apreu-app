import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { Calendar } from './calendar.js';

export interface ExpenseProps {
  categoryId: number | null;
  description: string;
  amount: Money;
  date: string;
  vendor: string | null;
  receiptNo: string | null;
  paymentMethod: string;
  notes: string | null;
  createdBy: number | null;
  createdAt: Date | null;
}

export interface CreateExpenseProps {
  categoryId: number | null;
  description: string;
  amount: number;
  date: string;
  vendor?: string | null;
  receiptNo?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  createdBy: number | null;
}

/**
 * Money paid out by the school (`expenses`). Legacy only wrote expenses when
 * closing payroll; here they are also registered manually. Invariant: amount > 0.
 */
export class Expense extends Entity<ExpenseProps> {
  private constructor(id: EntityId, props: ExpenseProps) {
    super(id, props);
  }

  static create(input: CreateExpenseProps): Expense {
    const description = input.description?.trim();
    Guard.againstEmpty(description, 'descripción');
    Guard.againstMaxLength(description, 255, 'descripción');
    const amount = Money.of(input.amount);
    if (!amount.isGreaterThan(Money.zero())) {
      throw new BusinessRuleViolationError('El valor del gasto debe ser mayor que cero.', 'INVALID_EXPENSE_AMOUNT');
    }
    Calendar.assertDate(input.date, 'fecha del gasto');
    const vendor = input.vendor?.trim() || null;
    Guard.againstMaxLength(vendor, 200, 'proveedor');
    const receiptNo = input.receiptNo?.trim() || null;
    Guard.againstMaxLength(receiptNo, 100, 'número de soporte');
    const paymentMethod = input.paymentMethod?.trim() || 'efectivo';
    Guard.againstMaxLength(paymentMethod, 30, 'método de pago');
    return new Expense(null, {
      categoryId: input.categoryId,
      description,
      amount,
      date: input.date,
      vendor,
      receiptNo,
      paymentMethod,
      notes: input.notes?.trim() || null,
      createdBy: input.createdBy,
      createdAt: null,
    });
  }

  static restore(id: number, props: ExpenseProps): Expense {
    return new Expense(id, { ...props });
  }

  get categoryId(): number | null {
    return this.props.categoryId;
  }
  get description(): string {
    return this.props.description;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get date(): string {
    return this.props.date;
  }
  get vendor(): string | null {
    return this.props.vendor;
  }
  get receiptNo(): string | null {
    return this.props.receiptNo;
  }
  get paymentMethod(): string {
    return this.props.paymentMethod;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
}
