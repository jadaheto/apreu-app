import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { PayFrequency } from '../../domain/payroll/pay-frequency.js';
import { PayrollPeriod } from '../../domain/payroll/payroll-period.js';
import { PAYROLL_PERIOD_REPOSITORY, type PayrollPeriodRepository } from '../../domain/payroll/payroll.repositories.js';
import { PayrollParametersProvider } from './payroll-parameters.provider.js';
import { toPayrollPeriodView, type PayrollPeriodView } from './payroll-views.js';

export interface CreatePayrollPeriodInput {
  actor: AuthenticatedActor;
  name?: string | null;
  startDate: string;
  endDate: string;
  paymentDate: string;
  frequency: PayFrequency;
}

/**
 * Opens a payroll period in DRAFT. Unlike the legacy (`hr/payroll.php`
 * action `create_period`), creation and liquidation are separate steps, the
 * frequency is explicit and overlapping periods are rejected (B-10).
 */
@Injectable()
export class CreatePayrollPeriodUseCase implements UseCase<CreatePayrollPeriodInput, PayrollPeriodView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    private readonly parameters: PayrollParametersProvider,
  ) {}

  async execute(input: CreatePayrollPeriodInput): Promise<PayrollPeriodView> {
    const period = PayrollPeriod.create({ ...input, createdBy: input.actor.userId });
    await this.parameters.forYear(period.year);
    const overlapping = await this.periods.findOverlapping(period.startDate, period.endDate);
    if (overlapping.length > 0) {
      throw new ConflictError(`Las fechas se cruzan con el período "${overlapping[0].name}".`, {
        periodIds: overlapping.map((p) => p.id),
      });
    }
    await this.periods.save(period);
    return toPayrollPeriodView(period);
  }
}
