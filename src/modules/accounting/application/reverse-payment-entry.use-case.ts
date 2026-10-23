import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { AutomaticEntryPoster, type AutomaticPostingResult } from './automatic-entry-poster.js';
import type { PaymentVoidedPayload } from './integration-events.js';
import { PAYMENT_SOURCE } from './post-payment-entry.use-case.js';

/**
 * Counter-entry for `finance.payment-voided`: reverses the receipt entry of
 * the payment on the voiding date (works even if the original period is
 * closed). Skipped with a warning when the payment was never booked.
 */
@Injectable()
export class ReversePaymentEntryUseCase implements UseCase<PaymentVoidedPayload, AutomaticPostingResult> {
  constructor(
    private readonly poster: AutomaticEntryPoster,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(payment: PaymentVoidedPayload): Promise<AutomaticPostingResult> {
    return this.poster.reverse({
      original: { type: PAYMENT_SOURCE, id: String(payment.paymentId) },
      source: { type: `${PAYMENT_SOURCE}-void`, id: String(payment.paymentId) },
      date: this.clock.now().toISOString(),
      description: `Anulación recibo ${payment.receiptNumber}: ${payment.reason}`,
    });
  }
}
