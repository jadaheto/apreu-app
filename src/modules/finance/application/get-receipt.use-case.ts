import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { PAYMENT_METHOD_LABELS } from '../domain/payment-method.js';
import { PAYMENT_QUERIES, type PaymentQueriesPort, type ReceiptData } from './ports/payment-queries.port.js';
import { StudentAccessPolicy } from './student-access.policy.js';

export interface ReceiptView extends ReceiptData {
  schoolName: string;
  schoolNit: string;
  methodLabel: string;
  appliedAmount: number;
  /** Part of the payment kept as credit balance. */
  unappliedAmount: number;
}

/**
 * Printable cash receipt (legacy `finance/print_receipt.php`) with the
 * school's name and NIT, the breakdown and the unapplied remainder. Receipt
 * numbers are sequential, so students/guardians only get their own (bug S6).
 */
@Injectable()
export class GetReceiptUseCase implements UseCase<{ receiptNumber: string; actor: AuthenticatedActor }, ReceiptView> {
  constructor(
    @Inject(PAYMENT_QUERIES) private readonly queries: PaymentQueriesPort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ receiptNumber, actor }: { receiptNumber: string; actor: AuthenticatedActor }): Promise<ReceiptView> {
    const receipt = await this.queries.findReceipt(receiptNumber);
    if (!receipt) throw new NotFoundError('Recibo', receiptNumber);
    await this.access.assertCanView(actor, receipt.studentId);
    const settings = await this.settings.load();
    const appliedCents = receipt.lines.reduce((total, line) => total + Math.round(line.amount * 100), 0);
    return {
      ...receipt,
      schoolName: settings.schoolName,
      schoolNit: settings.schoolNit,
      methodLabel: PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method,
      appliedAmount: appliedCents / 100,
      unappliedAmount: receipt.status === 'applied' ? (Math.round(receipt.amount * 100) - appliedCents) / 100 : 0,
    };
  }
}
