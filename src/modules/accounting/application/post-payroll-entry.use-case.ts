import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { PostingRuleKeys } from '../domain/posting-rule.js';
import { AutomaticEntryPoster, type AutomaticPostingResult } from './automatic-entry-poster.js';
import type { PayrollPeriodPaidPayload } from './integration-events.js';
import { POSTING_LOG, type PostingLogPort } from './ports/posting-log.port.js';

export interface PostPayrollEntryInput {
  payroll: PayrollPeriodPaidPayload;
  /** Instant the payroll was paid (event `occurredAt`): the entry date. */
  paidAt: Date;
}

/**
 * Payroll entry (SALA) for `hr.payroll-period-paid`:
 * D personnel expense for the gross total (`payroll.debit.gross`);
 * C deductions payable (`payroll.credit.deductions`); C bank for the net
 * (`payroll.credit.net`). Requires gross = deductions + net.
 */
@Injectable()
export class PostPayrollEntryUseCase implements UseCase<PostPayrollEntryInput, AutomaticPostingResult> {
  constructor(
    private readonly poster: AutomaticEntryPoster,
    @Inject(POSTING_LOG) private readonly log: PostingLogPort,
  ) {}

  async execute({ payroll, paidAt }: PostPayrollEntryInput): Promise<AutomaticPostingResult> {
    const gross = Money.of(payroll.grossTotal);
    const deductions = Money.of(payroll.deductionsTotal);
    const net = Money.of(payroll.netTotal);
    if (!gross.equals(deductions.add(net))) {
      this.log.warn(`Asiento de nómina omitido (periodo #${payroll.periodId}): devengado ≠ deducciones + neto.`, {
        reason: 'PAYROLL_NOT_BALANCED',
        ...payroll,
      });
      return { status: 'skipped', reason: 'PAYROLL_NOT_BALANCED' };
    }
    const description = `Nómina ${payroll.periodName} (${payroll.startDate} a ${payroll.endDate})`;
    return this.poster.post({
      source: { type: 'hr.payroll-period', id: String(payroll.periodId) },
      date: paidAt.toISOString(),
      type: 'SALA',
      description: description.slice(0, 255),
      lines: [
        { ruleKeys: PostingRuleKeys.payrollGross(), side: 'debit', amount: gross, description: 'Total devengado' },
        {
          ruleKeys: PostingRuleKeys.payrollDeductions(),
          side: 'credit',
          amount: deductions,
          description: 'Deducciones por pagar',
        },
        { ruleKeys: PostingRuleKeys.payrollNet(), side: 'credit', amount: net, description: 'Neto pagado' },
      ],
    });
  }
}
