import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import { sumPayrollTotals } from '../../domain/payroll/payroll-payment.js';
import {
  PAYROLL_NOVELTY_REPOSITORY,
  PAYROLL_PAYMENT_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollNoveltyRepository,
  type PayrollPaymentRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import {
  toPayrollNoveltyView,
  toPayrollPaymentView,
  toPayrollPeriodView,
  type PayrollPeriodDetailView,
} from './payroll-views.js';

/** Period header plus every payslip, its novelties and the informative employer cost. */
@Injectable()
export class GetPayrollPeriodDetailUseCase implements UseCase<number, PayrollPeriodDetailView> {
  constructor(
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(PAYROLL_NOVELTY_REPOSITORY) private readonly novelties: PayrollNoveltyRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
  ) {}

  async execute(periodId: number): Promise<PayrollPeriodDetailView> {
    const period = await this.periods.findById(periodId);
    if (!period) throw new NotFoundError('Período de nómina', periodId);
    const [payments, novelties] = await Promise.all([
      this.payments.findByPeriod(periodId),
      this.novelties.findByPeriod(periodId),
    ]);
    const ids = [...new Set([...payments, ...novelties].map((x) => x.employeeId))];
    const employees = new Map((await this.employees.findByIds(ids)).map((e) => [e.id as number, e]));
    return {
      period: toPayrollPeriodView(period),
      payments: payments.map((p) => toPayrollPaymentView(p, employees.get(p.employeeId))),
      novelties: novelties.map((n) => toPayrollNoveltyView(n, employees.get(n.employeeId)?.fullName ?? null)),
      employerCostTotal: sumPayrollTotals(payments).employerCost.amount,
    };
  }
}
