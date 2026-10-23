import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { BillingPeriod } from './billing-period.vo.js';
import { Calendar } from './calendar.js';
import type { ChargeAmounts } from './charge-amounts.vo.js';

/** `student_charges.status`. `overdue` is accepted from legacy rows but never written: it is derived. */
export type ChargeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export const CHARGE_STATUSES: readonly ChargeStatus[] = ['pending', 'partial', 'paid', 'overdue', 'cancelled'];
const OPEN_STATUSES: readonly ChargeStatus[] = ['pending', 'partial', 'overdue'];

export interface StudentChargeProps {
  studentId: number;
  conceptId: number;
  description: string;
  amounts: ChargeAmounts;
  period: BillingPeriod;
  dueDate: string;
  status: ChargeStatus;
  academicYear: number;
  createdBy: number | null;
  /** Σ applications of non-reversed payments (rule RN-10); derived, not stored in the row. */
  paidAmount: Money;
  createdAt: Date | null;
}

export interface CreateStudentChargeProps {
  studentId: number;
  conceptId: number;
  description: string;
  amounts: ChargeAmounts;
  period: BillingPeriod;
  dueDate: string;
  academicYear: number;
  createdBy: number | null;
}

/**
 * A debt of a student for a billing concept (`student_charges`, source of
 * truth; the legacy `charges` table is not used). Legacy
 * `finance/student_billing.php` and `finance/cashier.php`.
 *
 * State machine (analysis §3.7): pending → partial → paid by payments;
 * reverting payments recalculates the status; pending/overdue charges without
 * payments may be cancelled (terminal). "Overdue" is derived from the due date.
 */
export class StudentCharge extends Entity<StudentChargeProps> {
  private constructor(id: EntityId, props: StudentChargeProps) {
    super(id, props);
  }

  static create(input: CreateStudentChargeProps): StudentCharge {
    const description = input.description?.trim();
    Guard.againstEmpty(description, 'descripción');
    Guard.againstMaxLength(description, 255, 'descripción');
    Calendar.assertDate(input.dueDate, 'vencimiento');
    return new StudentCharge(null, {
      ...input,
      description,
      status: 'pending',
      paidAmount: Money.zero(),
      createdAt: null,
    });
  }

  static restore(id: number, props: StudentChargeProps): StudentCharge {
    return new StudentCharge(id, { ...props });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get conceptId(): number {
    return this.props.conceptId;
  }
  get description(): string {
    return this.props.description;
  }
  get amounts(): ChargeAmounts {
    return this.props.amounts;
  }
  get period(): BillingPeriod {
    return this.props.period;
  }
  get dueDate(): string {
    return this.props.dueDate;
  }
  get status(): ChargeStatus {
    return this.props.status;
  }
  get academicYear(): number {
    return this.props.academicYear;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get paidAmount(): Money {
    return this.props.paidAmount;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  /** `net − paid`, never negative. */
  get pendingAmount(): Money {
    const pending = this.props.amounts.net.subtract(this.props.paidAmount);
    return pending.isNegative() ? Money.zero() : pending;
  }

  get isOpen(): boolean {
    return OPEN_STATUSES.includes(this.props.status) && !this.pendingAmount.isZero();
  }

  get isCancelled(): boolean {
    return this.props.status === 'cancelled';
  }

  /** Rule RN-19: open, with balance and past its due date. */
  isOverdue(today: string): boolean {
    return this.isOpen && this.props.dueDate < today;
  }

  /** Records a payment application (rule RN-14: never more than the pending balance). */
  applyPayment(amount: Money): void {
    if (!this.isOpen) {
      throw new BusinessRuleViolationError('El cargo no admite abonos.', 'CHARGE_NOT_OPEN', { chargeId: this.id });
    }
    if (!amount.isGreaterThan(Money.zero()) || amount.isGreaterThan(this.pendingAmount)) {
      throw new BusinessRuleViolationError('El abono supera el saldo pendiente del cargo.', 'CHARGE_OVERPAYMENT', {
        chargeId: this.id,
      });
    }
    this.props.paidAmount = this.props.paidAmount.add(amount);
    this.recalculateStatus();
  }

  /** Undoes an application of a voided payment and recalculates the status. */
  revertPayment(amount: Money): void {
    const paid = this.props.paidAmount.subtract(amount);
    this.props.paidAmount = paid.isNegative() ? Money.zero() : paid;
    if (!this.isCancelled) this.recalculateStatus();
  }

  /** Cancels a charge that has no payments applied. */
  cancel(): void {
    if (!['pending', 'overdue'].includes(this.props.status) || !this.props.paidAmount.isZero()) {
      throw new BusinessRuleViolationError(
        'Sólo se pueden anular cargos pendientes y sin abonos.',
        'CHARGE_NOT_CANCELLABLE',
        { chargeId: this.id },
      );
    }
    this.props.status = 'cancelled';
  }

  private recalculateStatus(): void {
    const { paidAmount, amounts } = this.props;
    if (!paidAmount.isLessThan(amounts.net)) this.props.status = 'paid';
    else if (paidAmount.isGreaterThan(Money.zero())) this.props.status = 'partial';
    else this.props.status = 'pending';
  }
}
