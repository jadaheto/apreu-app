import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { BillingMonth } from '../../domain/common/billing-month.js';
import { BILLING_CHARGES, type BillingChargesPort } from '../../domain/directory/billing-charges.port.js';

export interface PreviewBillingNoticesInput {
  month: string;
  conceptId?: number;
}

export interface BillingNoticesPreview {
  month: string;
  charges: number;
  totalAmount: number;
  /** Distinct guardian e-mails that would receive a message. */
  guardiansWithEmail: number;
  /** Distinct guardian mobiles that would receive a WhatsApp. */
  guardiansWithMobile: number;
  /** Students with charges whose guardian has no e-mail. */
  studentsWithoutEmail: number;
}

/** Preview of a billing-notice run (legacy `email/send_billing.php` preview card). */
@Injectable()
export class PreviewBillingNoticesUseCase implements UseCase<PreviewBillingNoticesInput, BillingNoticesPreview> {
  constructor(@Inject(BILLING_CHARGES) private readonly charges: BillingChargesPort) {}

  async execute(input: PreviewBillingNoticesInput): Promise<BillingNoticesPreview> {
    const month = BillingMonth.create(input.month);
    const charges = await this.charges.pendingCharges({
      from: month.firstDay,
      to: month.lastDay,
      conceptId: input.conceptId,
    });
    const distinct = (values: (string | number | null)[]) => new Set(values.filter((value) => value)).size;
    return {
      month: month.toString(),
      charges: charges.length,
      totalAmount: charges.reduce((sum, charge) => sum.add(Money.of(charge.netAmount)), Money.zero()).amount,
      guardiansWithEmail: distinct(charges.map((charge) => charge.guardianEmail?.toLowerCase() ?? null)),
      guardiansWithMobile: distinct(charges.map((charge) => charge.guardianMobile)),
      studentsWithoutEmail: distinct(
        charges.filter((charge) => !charge.guardianEmail).map((charge) => charge.studentId),
      ),
    };
  }
}
