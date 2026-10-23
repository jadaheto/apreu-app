import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../domain/payment-method.js';
import { PAYMENT_QUERIES, type PaymentListItem, type PaymentQueriesPort } from './ports/payment-queries.port.js';

export interface CountAndAmount {
  count: number;
  amount: number;
}

export interface ReconciliationView {
  month: string;
  total: CountAndAmount;
  reconciled: CountAndAmount;
  pending: CountAndAmount;
  /** Top 3 payment channels by amount. */
  byMethod: (CountAndAmount & { method: PaymentMethod; label: string })[];
  payments: PaymentListItem[];
}

const TOP_METHODS = 3;

const totals = (payments: PaymentListItem[]): CountAndAmount => ({
  count: payments.length,
  amount: payments.reduce((total, payment) => total.add(Money.of(payment.amount)), Money.zero()).amount,
});

/** Applied payments of a month with reconciliation KPIs (legacy `finance/reconciliation.php`). */
@Injectable()
export class GetReconciliationUseCase implements UseCase<{ month?: string }, ReconciliationView> {
  constructor(
    @Inject(PAYMENT_QUERIES) private readonly queries: PaymentQueriesPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ month }: { month?: string }): Promise<ReconciliationView> {
    const period = month ? BillingPeriod.create(month) : BillingPeriod.fromDate(Calendar.today(this.clock.now()));
    const payments = await this.queries.forReconciliation(period);
    const methods = [...new Set(payments.map((payment) => payment.method))].map((method) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      ...totals(payments.filter((payment) => payment.method === method)),
    }));
    return {
      month: period.toString(),
      total: totals(payments),
      reconciled: totals(payments.filter((payment) => payment.reconciled)),
      pending: totals(payments.filter((payment) => !payment.reconciled)),
      byMethod: methods.sort((a, b) => b.amount - a.amount).slice(0, TOP_METHODS),
      payments,
    };
  }
}
