import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { mapPage, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import {
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollPeriodCriteria,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { toPayrollPeriodView, type PayrollPeriodView } from './payroll-views.js';

export interface ListPayrollPeriodsInput {
  criteria: PayrollPeriodCriteria;
  page: PageRequest;
}

/** Payroll periods, newest first, filtered by year and status. */
@Injectable()
export class ListPayrollPeriodsUseCase implements UseCase<ListPayrollPeriodsInput, Paginated<PayrollPeriodView>> {
  constructor(@Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository) {}

  async execute({ criteria, page }: ListPayrollPeriodsInput): Promise<Paginated<PayrollPeriodView>> {
    return mapPage(await this.periods.search(criteria, page), toPayrollPeriodView);
  }
}
