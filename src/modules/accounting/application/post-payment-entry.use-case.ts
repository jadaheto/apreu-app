import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PostingRuleKeys } from '../domain/posting-rule.js';
import { AutomaticEntryPoster, type AutomaticLine, type AutomaticPostingResult } from './automatic-entry-poster.js';
import type { PaymentRegisteredPayload } from './integration-events.js';

/** Source type stored in `accounting_journal_entries.source_type` for cashier receipts. */
export const PAYMENT_SOURCE = 'finance.payment';

/**
 * Receipt entry (RC) for `finance.payment-registered`:
 * D cash/bank by payment method (`payment.debit.*`) for the total;
 * C income by billing concept, then by concept category (`payment.credit.*`)
 * for each applied charge;
 * C unapplied surplus (`payment.credit.unapplied`) when the total exceeds the
 * applied charges.
 */
@Injectable()
export class PostPaymentEntryUseCase implements UseCase<PaymentRegisteredPayload, AutomaticPostingResult> {
  constructor(private readonly poster: AutomaticEntryPoster) {}

  execute(payment: PaymentRegisteredPayload): Promise<AutomaticPostingResult> {
    const total = Money.of(payment.totalAmount);
    const credits: AutomaticLine[] = payment.appliedCharges.map((charge) => ({
      ruleKeys: PostingRuleKeys.paymentCredit(charge.conceptId, charge.conceptCategory),
      side: 'credit',
      amount: Money.of(charge.amount),
      description: charge.conceptName,
    }));
    const applied = credits.reduce((acc, line) => acc.add(line.amount), Money.zero());
    if (total.isGreaterThan(applied)) {
      credits.push({
        ruleKeys: PostingRuleKeys.paymentUnapplied(),
        side: 'credit',
        amount: total.subtract(applied),
        description: 'Saldo no aplicado a cargos',
      });
    }
    return this.poster.post({
      source: { type: PAYMENT_SOURCE, id: String(payment.paymentId) },
      date: payment.paidAt,
      type: 'RC',
      description: `Recibo de caja ${payment.receiptNumber}`,
      lines: [
        {
          ruleKeys: PostingRuleKeys.paymentDebit(payment.method),
          side: 'debit',
          amount: total,
          description: `Pago ${payment.method}`,
        },
        ...credits,
      ],
    });
  }
}
