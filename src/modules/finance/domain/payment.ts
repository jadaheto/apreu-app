import { BusinessRuleViolationError, ConflictError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PAYMENT_METHODS, type PaymentMethod } from './payment-method.js';

/** `payments.status`: `applied` (registered at the cashier) or `reversed` (voided, terminal). */
export type PaymentStatus = 'applied' | 'reversed' | 'pending';
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['applied', 'reversed', 'pending'];

/** Part of a payment applied to a charge (`payment_applications`). */
export interface PaymentApplication {
  id: number | null;
  chargeId: number;
  amount: Money;
}

/** Manual bank reconciliation data (`payments.bank_ref`, `reconciled_at`, `reconciled_by`). */
export interface Reconciliation {
  bankRef: string;
  reconciledAt: Date;
  reconciledBy: number | null;
}

/** Who voided the payment, when and why. */
export interface Voiding {
  reason: string;
  voidedAt: Date;
  voidedBy: number | null;
}

export interface PaymentProps {
  studentId: number;
  receiptNumber: string;
  amount: Money;
  method: PaymentMethod;
  paidAt: Date;
  cashierId: number | null;
  notes: string | null;
  reference: string | null;
  status: PaymentStatus;
  applications: PaymentApplication[];
  reconciliation: Reconciliation | null;
  voiding: Voiding | null;
  createdAt: Date | null;
}

export interface RegisterPaymentProps {
  studentId: number;
  receiptNumber: string;
  amount: Money;
  method: PaymentMethod;
  paidAt: Date;
  cashierId: number | null;
  notes?: string | null;
  reference?: string | null;
}

/**
 * Money received from a student at the cashier (`payments` + its
 * `payment_applications`). Legacy `finance/cashier.php`,
 * `finance/reconciliation.php`.
 *
 * Invariants: amount > 0; Σ applications ≤ amount; the unapplied remainder of
 * an applied payment is the student's explicit credit balance ("saldo a
 * favor", fixes bug B4); only applied payments are reconciled; a reconciled
 * payment cannot be voided until it is unreconciled.
 */
export class Payment extends Entity<PaymentProps> {
  private constructor(id: EntityId, props: PaymentProps) {
    super(id, props);
  }

  static register(input: RegisterPaymentProps): Payment {
    if (!input.amount.isGreaterThan(Money.zero())) {
      throw new BusinessRuleViolationError('El valor del pago debe ser mayor que cero.', 'INVALID_PAYMENT_AMOUNT');
    }
    Guard.oneOf(input.method, PAYMENT_METHODS, 'método de pago');
    Guard.againstEmpty(input.receiptNumber, 'número de recibo');
    const reference = input.reference?.trim() || null;
    Guard.againstMaxLength(reference, 100, 'referencia');
    const notes = input.notes?.trim() || null;
    Guard.againstMaxLength(notes, 1000, 'observaciones');
    return new Payment(null, {
      studentId: input.studentId,
      receiptNumber: input.receiptNumber,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt,
      cashierId: input.cashierId,
      notes,
      reference,
      status: 'applied',
      applications: [],
      reconciliation: null,
      voiding: null,
      createdAt: null,
    });
  }

  static restore(id: number, props: PaymentProps): Payment {
    return new Payment(id, { ...props, applications: [...props.applications] });
  }

  get studentId(): number {
    return this.props.studentId;
  }
  get receiptNumber(): string {
    return this.props.receiptNumber;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get paidAt(): Date {
    return this.props.paidAt;
  }
  get cashierId(): number | null {
    return this.props.cashierId;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get reference(): string | null {
    return this.props.reference;
  }
  get status(): PaymentStatus {
    return this.props.status;
  }
  get applications(): readonly PaymentApplication[] {
    return this.props.applications;
  }
  get reconciliation(): Reconciliation | null {
    return this.props.reconciliation;
  }
  get voiding(): Voiding | null {
    return this.props.voiding;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get isApplied(): boolean {
    return this.props.status === 'applied';
  }

  get appliedAmount(): Money {
    return this.props.applications.reduce((total, application) => total.add(application.amount), Money.zero());
  }

  /** Credit balance left by this payment (zero unless the payment is applied). */
  get unappliedAmount(): Money {
    return this.isApplied ? this.props.amount.subtract(this.appliedAmount) : Money.zero();
  }

  /** Applications not yet persisted. */
  get pendingApplications(): PaymentApplication[] {
    return this.props.applications.filter((application) => application.id === null);
  }

  /** Applies part of the payment to a charge; never more than the unapplied remainder. */
  allocate(chargeId: number, amount: Money): void {
    this.assertApplied();
    if (!amount.isGreaterThan(Money.zero()) || amount.isGreaterThan(this.unappliedAmount)) {
      throw new BusinessRuleViolationError(
        'La aplicación supera el valor disponible del pago.',
        'PAYMENT_OVERALLOCATION',
        { paymentId: this.id },
      );
    }
    this.props.applications.push({ id: null, chargeId, amount });
  }

  /** Assigns the ids generated by the persistence layer to the new applications, in order. */
  assignApplicationIds(ids: number[]): void {
    const pending = this.pendingApplications;
    if (ids.length !== pending.length) throw new Error('Cantidad de identificadores de aplicación inválida.');
    pending.forEach((application, index) => (application.id = ids[index]));
  }

  /** Rule RN-23: records the bank reference of an applied payment. */
  reconcile(bankRef: string, at: Date, by: number | null): void {
    this.assertApplied();
    const reference = bankRef?.trim();
    Guard.againstEmpty(reference, 'referencia bancaria');
    Guard.againstMaxLength(reference, 100, 'referencia bancaria');
    if (this.props.reconciliation) {
      throw new ConflictError('El pago ya está conciliado.', { paymentId: this.id });
    }
    this.props.reconciliation = { bankRef: reference, reconciledAt: at, reconciledBy: by };
  }

  unreconcile(): void {
    if (!this.props.reconciliation) {
      throw new BusinessRuleViolationError('El pago no está conciliado.', 'PAYMENT_NOT_RECONCILED', {
        paymentId: this.id,
      });
    }
    this.props.reconciliation = null;
  }

  /**
   * Voids the payment: it stops counting as income and its applications stop
   * counting as paid (the caller reverts the affected charges).
   */
  void(reason: string, at: Date, by: number | null): void {
    this.assertApplied();
    if (this.props.reconciliation) {
      throw new BusinessRuleViolationError(
        'No se puede anular un pago conciliado. Desconcílielo primero.',
        'PAYMENT_RECONCILED',
        { paymentId: this.id },
      );
    }
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo de anulación');
    Guard.againstMaxLength(trimmed, 255, 'motivo de anulación');
    this.props.status = 'reversed';
    this.props.voiding = { reason: trimmed, voidedAt: at, voidedBy: by };
  }

  private assertApplied(): void {
    if (!this.isApplied) {
      throw new BusinessRuleViolationError('El pago está anulado.', 'PAYMENT_NOT_APPLIED', { paymentId: this.id });
    }
  }
}
