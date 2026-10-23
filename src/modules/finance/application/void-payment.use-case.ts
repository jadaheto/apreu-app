import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../domain/payment.repository.js';
import { STUDENT_CHARGE_REPOSITORY, type StudentChargeRepository } from '../domain/student-charge.repository.js';
import { PAYMENT_VOIDED, type PaymentVoidedPayload } from './integration-events.js';

export interface VoidPaymentInput {
  paymentId: number;
  reason: string;
  actor: AuthenticatedActor;
}

export interface VoidedPaymentView {
  paymentId: number;
  receiptNumber: string;
  status: string;
  revertedCharges: number[];
}

/**
 * Voids (reverses) a payment (state `reversed`, not implemented in legacy):
 * its applications stop counting as paid and the affected charges are
 * recalculated (analysis §3.7/§3.8). Reconciled payments must be unreconciled
 * first. The receipt number is kept (no gaps). Publishes `finance.payment-voided`.
 */
@Injectable()
export class VoidPaymentUseCase implements UseCase<VoidPaymentInput, VoidedPaymentView> {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(STUDENT_CHARGE_REPOSITORY) private readonly charges: StudentChargeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ paymentId, reason, actor }: VoidPaymentInput): Promise<VoidedPaymentView> {
    const payment = await this.uow.runInTransaction(async () => {
      const found = await this.payments.findById(paymentId, { forUpdate: true });
      if (!found) throw new NotFoundError('Pago', paymentId);
      const charges = await this.charges.findByIds(
        [...new Set(found.applications.map((application) => application.chargeId))],
        { forUpdate: true },
      );
      found.void(reason, this.clock.now(), actor.userId);
      for (const application of found.applications) {
        charges.find((charge) => charge.id === application.chargeId)?.revertPayment(application.amount);
      }
      await this.payments.save(found);
      await this.charges.saveMany(charges);
      return found;
    });

    const payload: PaymentVoidedPayload = {
      paymentId: payment.id as number,
      receiptNumber: payment.receiptNumber,
      reason: payment.voiding?.reason ?? reason,
    };
    await this.events.publish({ name: PAYMENT_VOIDED, occurredAt: this.clock.now(), payload: { ...payload } });
    return {
      paymentId: payment.id as number,
      receiptNumber: payment.receiptNumber,
      status: payment.status,
      revertedCharges: [...new Set(payment.applications.map((application) => application.chargeId))],
    };
  }
}
