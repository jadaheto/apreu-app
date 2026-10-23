import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  type PayrollPaymentRepository,
} from '../../domain/payroll/payroll.repositories.js';

export interface PayrollKpisView {
  month: string;
  employees: number;
  gross: number;
  deductions: number;
  net: number;
}

/**
 * KPIs of a month `YYYY-MM` (payslips of non-cancelled periods starting that
 * month). The month is validated, closing the legacy reflected XSS (S-7).
 */
@Injectable()
export class GetPayrollKpisUseCase implements UseCase<string, PayrollKpisView> {
  constructor(@Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository) {}

  async execute(month: string): Promise<PayrollKpisView> {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? '');
    if (!match) throw new BusinessRuleViolationError('El mes debe tener formato AAAA-MM.', 'INVALID_MONTH');
    const kpis = await this.payments.monthKpis(Number(match[1]), Number(match[2]));
    return {
      month,
      employees: kpis.employees,
      gross: kpis.gross.amount,
      deductions: kpis.deductions.amount,
      net: kpis.net.amount,
    };
  }
}
