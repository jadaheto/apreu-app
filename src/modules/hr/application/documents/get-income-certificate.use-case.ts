import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  type PayrollPaymentRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isPayrollViewer } from '../hr-access.js';

export interface GetIncomeCertificateInput {
  actor: AuthenticatedActor;
  employeeId?: number;
  year: number;
}

export interface IncomeCertificateView {
  year: number;
  employee: { id: number; fullName: string; document: string };
  payments: number;
  grossPayments: number;
  mandatoryContributions: { health: number; pension: number; solidarityFund: number; total: number };
  withholding: number;
  netPaid: number;
  note: string;
}

/**
 * Income and withholding summary of a taxable year computed from the payslips
 * actually paid (the legacy multiplied the current salary × 12 and showed a
 * zero withholding, B-28). Informative: the official DIAN Formulario 220 also
 * needs severance and other items outside this module.
 */
@Injectable()
export class GetIncomeCertificateUseCase implements UseCase<GetIncomeCertificateInput, IncomeCertificateView> {
  constructor(
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute({ actor, employeeId, year }: GetIncomeCertificateInput): Promise<IncomeCertificateView> {
    const currentYear = CalendarDate.parts(CalendarDate.fromInstant(this.clock.now())).year;
    if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
      throw new BusinessRuleViolationError('El año gravable no es válido.', 'INVALID_YEAR');
    }
    const employee = await this.currentEmployee.resolveTarget(actor, employeeId, isPayrollViewer(actor));
    const totals = await this.payments.annualTotals(employee.id as number, year);
    const contributions = totals.health.add(totals.pension).add(totals.solidarityFund);
    return {
      year,
      employee: {
        id: employee.id as number,
        fullName: employee.fullName,
        document: `${employee.documentType.toUpperCase()} ${employee.documentNumber}`,
      },
      payments: totals.payments,
      grossPayments: totals.gross.amount,
      mandatoryContributions: {
        health: totals.health.amount,
        pension: totals.pension.amount,
        solidarityFund: totals.solidarityFund.amount,
        total: contributions.amount,
      },
      withholding: totals.withholding.amount,
      netPaid: totals.net.amount,
      note: 'Resumen informativo de pagos de nómina efectivamente pagados; no reemplaza el Formulario 220 de la DIAN.',
    };
  }
}
