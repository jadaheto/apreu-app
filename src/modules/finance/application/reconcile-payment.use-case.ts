import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';

export interface ReconcilePaymentInput {
  paymentId: number;
  bankRef: string;
  actor: AuthenticatedActor;
}

export interface ReconciliationStatusView {
  paymentId: number;
  reconciled: boolean;
  bankRef: string | null;
  reconciledAt: Date | null;
}

/**
 * Marks an applied payment as reconciled with a bank reference (rule RN-23).
 * Fixes bug B28: the payment must exist and be applied, and the reference
 * cannot be reused by another payment.
 */
@Injectable()
export class ReconcilePaymentUseCase implements UseCase<ReconcilePaymentInput, ReconciliationStatusView> {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ paymentId, bankRef, actor }: ReconcilePaymentInput): Promise<ReconciliationStatusView> {
    return this.uow.runInTransaction(async () => {
      const payment = await this.payments.findById(paymentId, { forUpdate: true });
      if (!payment) throw new NotFoundError('Pago', paymentId);
      const reference = bankRef?.trim() ?? '';
      if (reference && (await this.payments.isBankRefTaken(reference, paymentId))) {
        throw new ConflictError('La referencia bancaria ya fue usada en otro pago.', { bankRef: reference });
      }
      payment.reconcile(reference, this.clock.now(), actor.userId);
      await this.payments.save(payment);
      return {
        paymentId,
        reconciled: true,
        bankRef: payment.reconciliation?.bankRef ?? null,
        reconciledAt: payment.reconciliation?.reconciledAt ?? null,
      };
    });
  }
}
