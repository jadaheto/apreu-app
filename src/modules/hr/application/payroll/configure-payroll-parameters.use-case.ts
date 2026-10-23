import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { PayrollParameters, type PayrollParametersInput } from '../../domain/payroll/payroll-parameters.js';
import {
  PAYROLL_PARAMETERS_REPOSITORY,
  type PayrollParametersRepository,
} from '../../domain/payroll/payroll-parameters.repository.js';
import { PAYROLL_PERIOD_REPOSITORY, type PayrollPeriodRepository } from '../../domain/payroll/payroll.repositories.js';
import { toPayrollParametersView, type PayrollParametersView } from './payroll-views.js';

export interface ConfigurePayrollParametersInput {
  actor: AuthenticatedActor;
  year: number;
  values: PayrollParametersInput;
}

/**
 * Sets SMMLV, transport allowance, UVT, rates and the art. 114-1 exemption of
 * a year. A year with paid periods is immutable (the paid payslips used it).
 */
@Injectable()
export class ConfigurePayrollParametersUseCase implements UseCase<
  ConfigurePayrollParametersInput,
  PayrollParametersView
> {
  constructor(
    @Inject(PAYROLL_PARAMETERS_REPOSITORY) private readonly repository: PayrollParametersRepository,
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
  ) {}

  async execute({ actor, year, values }: ConfigurePayrollParametersInput): Promise<PayrollParametersView> {
    if (await this.periods.existsPaidInYear(year)) {
      throw new BusinessRuleViolationError(
        `Los parámetros de ${year} ya se usaron en nóminas pagadas y no se pueden modificar.`,
        'PAYROLL_PARAMETERS_LOCKED',
      );
    }
    const params = PayrollParameters.create(year, values);
    await this.repository.save(params, actor.userId);
    return toPayrollParametersView(params, 'configured');
  }
}
