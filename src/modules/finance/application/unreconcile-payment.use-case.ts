import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';
import type { ReconciliationStatusView } from './reconcile-payment.use-case.js';

/** Reverts a reconciliation, clearing reference, date and user (rule RN-23). */
@Injectable()
export class UnreconcilePaymentUseCase implements UseCase<{ paymentId: number }, ReconciliationStatusView> {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute({ paymentId }: { paymentId: number }): Promise<ReconciliationStatusView> {
    return this.uow.runInTransaction(async () => {
      const payment = await this.payments.findById(paymentId, { forUpdate: true });
      if (!payment) throw new NotFoundError('Pago', paymentId);
      payment.unreconcile();
      await this.payments.save(payment);
      return { paymentId, reconciled: false, bankRef: null, reconciledAt: null };
    });
  }
}
