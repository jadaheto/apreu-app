import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { Payment } from './payment.js';
import type { StudentCharge } from './student-charge.js';

/** One application decided by the allocator. */
export interface Allocation {
  charge: StudentCharge;
  amount: Money;
}

/** FIFO order: oldest due date first, then lowest id (rule RN-13). */
export const byAge = (a: StudentCharge, b: StudentCharge): number =>
  a.dueDate.localeCompare(b.dueDate) || (a.id ?? 0) - (b.id ?? 0);

/**
 * Distributes money of a payment among open charges of the same student,
 * oldest first (rules RN-13/RN-14). The order is imposed by the server, not by
 * the client (legacy bug B5); cancelled, paid or foreign charges are skipped
 * (bug B6). What cannot be applied stays as the payment's unapplied remainder
 * (credit balance).
 */
export const PaymentAllocator = {
  settle(payment: Payment, charges: StudentCharge[]): Allocation[] {
    const allocations: Allocation[] = [];
    for (const charge of [...charges].sort(byAge)) {
      const available = payment.unappliedAmount;
      if (available.isZero()) break;
      if (charge.studentId !== payment.studentId || !charge.isOpen) continue;
      const amount = available.min(charge.pendingAmount);
      payment.allocate(charge.id as number, amount);
      charge.applyPayment(amount);
      allocations.push({ charge, amount });
    }
    return allocations;
  },
};
