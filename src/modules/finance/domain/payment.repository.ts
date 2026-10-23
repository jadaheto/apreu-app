import type { Payment } from './payment.js';
import type { LockOptions } from './student-charge.repository.js';

/** Output port for {@link Payment} persistence (payment row plus its applications). */
export interface PaymentRepository {
  findById(id: number, options?: LockOptions): Promise<Payment | null>;
  /** Applied payments of the student with an unapplied remainder (credit balance), oldest first. */
  findWithCredit(studentId: number, options?: LockOptions): Promise<Payment[]>;
  /** True when another payment already uses the bank reference. */
  isBankRefTaken(bankRef: string, exceptPaymentId: number): Promise<boolean>;
  /** Inserts or updates the payment and inserts its new applications. */
  save(payment: Payment): Promise<void>;
}

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');
