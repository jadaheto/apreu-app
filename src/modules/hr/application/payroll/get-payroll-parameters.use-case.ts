import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { PayrollParametersProvider } from './payroll-parameters.provider.js';
import { toPayrollParametersView, type PayrollParametersView } from './payroll-views.js';

/** Legal payroll parameters of a year, configured or built-in. */
@Injectable()
export class GetPayrollParametersUseCase implements UseCase<number, PayrollParametersView> {
  constructor(private readonly provider: PayrollParametersProvider) {}

  async execute(year: number): Promise<PayrollParametersView> {
    const found = await this.provider.find(year);
    if (!found) throw new NotFoundError('Parámetros de nómina del año', year);
    return toPayrollParametersView(found.params, found.source);
  }
}
