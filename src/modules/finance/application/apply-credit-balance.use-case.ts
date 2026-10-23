import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PaymentAllocator } from '../domain/payment-allocator.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import { CREDIT_APPLIED, type CreditAppliedPayload } from './integration-events.js';

export interface CreditApplicationView {
  studentId: number;
  appliedAmount: number;
  remainingCredit: number;
  applications: CreditAppliedPayload['applications'];
}

/**
 * Applies the student's credit balance (unapplied money of previous payments)
 * to their open charges: oldest credit first, oldest charge first. The
 * applications belong to the original payments, so voiding one of them later
 * reverts them consistently. Publishes `finance.credit-applied` when anything
 * was applied.
 */
@Injectable()
export class ApplyCreditBalanceUseCase implements UseCase<{ studentId: number }, CreditApplicationView> {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ studentId }: { studentId: number }): Promise<CreditApplicationView> {
    if (!(await this.students.findById(studentId))) throw new NotFoundError('Estudiante', studentId);

    const result = await this.uow.runInTransaction(async () => {
      const credits = await this.payments.findWithCredit(studentId, { forUpdate: true });
      const open = await this.charges.findOpenByStudent(studentId, { forUpdate: true });
      const applications: CreditAppliedPayload['applications'] = [];
      for (const payment of credits) {
        const allocations = PaymentAllocator.settle(payment, open);
        if (allocations.length === 0) continue;
        await this.payments.save(payment);
        applications.push(
          ...allocations.map(({ charge, amount }) => ({
            paymentId: payment.id as number,
            receiptNumber: payment.receiptNumber,
            studentChargeId: charge.id as number,
            conceptId: charge.conceptId,
            amount: amount.amount,
          })),
        );
      }
      await this.charges.saveMany(open.filter((charge) => applications.some((a) => a.studentChargeId === charge.id)));
      const remaining = credits.reduce((total, payment) => total.add(payment.unappliedAmount), Money.zero());
      return { applications, remaining };
    });

    if (result.applications.length > 0) {
      const payload: CreditAppliedPayload = { studentId, applications: result.applications };
      await this.events.publish({ name: CREDIT_APPLIED, occurredAt: this.clock.now(), payload: { ...payload } });
    }
    const applied = result.applications.reduce((total, a) => total.add(Money.of(a.amount)), Money.zero());
    return {
      studentId,
      appliedAmount: applied.amount,
      remainingCredit: result.remaining.amount,
      applications: result.applications,
    };
  }
}
