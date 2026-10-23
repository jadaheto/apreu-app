import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import { amountInWords } from '../../domain/documents/amount-in-words.js';
import { INSTITUTION_PROFILE, type InstitutionProfilePort } from '../../domain/documents/institution-profile.port.js';
import { CONTRACT_LABELS } from '../../domain/employees/employee-catalogs.js';
import type { Employee } from '../../domain/employees/employee.js';
import { EMPLOYEE_REPOSITORY, type EmployeeRepository } from '../../domain/employees/employee.repository.js';
import type { PayrollParameters } from '../../domain/payroll/payroll-parameters.js';
import type { PayrollPayment } from '../../domain/payroll/payroll-payment.js';
import type { PayrollPeriod } from '../../domain/payroll/payroll-period.js';
import {
  PAYROLL_PAYMENT_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
  type PayrollPaymentRepository,
  type PayrollPeriodRepository,
} from '../../domain/payroll/payroll.repositories.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isPayrollViewer } from '../hr-access.js';
import { PayrollParametersProvider } from '../payroll/payroll-parameters.provider.js';
import type { PayslipDocument, PayslipLine } from './document-models.js';

export interface GetPayslipInput {
  actor: AuthenticatedActor;
  paymentId: number;
}

/**
 * Payslip data. HR, finance and administrators see any payslip; any other
 * user only their own, and only once the period is approved. A payslip that
 * is not visible answers 404 (no IDOR, legacy S-13).
 */
@Injectable()
export class GetPayslipUseCase implements UseCase<GetPayslipInput, PayslipDocument> {
  constructor(
    @Inject(PAYROLL_PAYMENT_REPOSITORY) private readonly payments: PayrollPaymentRepository,
    @Inject(PAYROLL_PERIOD_REPOSITORY) private readonly periods: PayrollPeriodRepository,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(INSTITUTION_PROFILE) private readonly institution: InstitutionProfilePort,
    private readonly currentEmployee: CurrentEmployeeResolver,
    private readonly parameters: PayrollParametersProvider,
  ) {}

  async execute({ actor, paymentId }: GetPayslipInput): Promise<PayslipDocument> {
    const payment = await this.payments.findById(paymentId);
    const period = payment ? await this.periods.findById(payment.periodId) : null;
    if (!payment || !period || !(await this.isVisible(actor, payment, period))) {
      throw new NotFoundError('Desprendible de pago', paymentId);
    }
    const employee = await this.employees.findById(payment.employeeId);
    if (!employee) throw new NotFoundError('Empleado', payment.employeeId);
    const params = (await this.parameters.find(period.year))?.params ?? null;
    return buildPayslip(await this.institution.get(), payment, period, employee, params);
  }

  private async isVisible(actor: AuthenticatedActor, payment: PayrollPayment, period: PayrollPeriod): Promise<boolean> {
    if (isPayrollViewer(actor)) return true;
    const own = await this.currentEmployee.find(actor);
    return own?.id === payment.employeeId && period.isReleased && payment.status !== 'cancelled';
  }
}

const rateLabel = (label: string, rate: number | undefined) => (rate === undefined ? label : `${label} (${rate} %)`);

/** Keeps mandatory lines and any other line with a value (legacy rule 23). */
const lines = (entries: [string, number, boolean?][]): PayslipLine[] =>
  entries.filter(([, amount, always]) => always || amount > 0).map(([label, amount]) => ({ label, amount }));

function buildPayslip(
  institution: PayslipDocument['institution'],
  p: PayrollPayment,
  period: PayrollPeriod,
  e: Employee,
  params: PayrollParameters | null,
): PayslipDocument {
  const account = e.bankAccount;
  return {
    institution,
    paymentId: p.id as number,
    status: p.status,
    period: {
      id: period.id as number,
      name: period.name,
      label: period.periodLabel,
      startDate: period.startDate,
      endDate: period.endDate,
      paymentDate: period.paymentDate,
    },
    employee: {
      fullName: e.fullName,
      code: e.code,
      document: `${e.documentType.toUpperCase()} ${e.documentNumber}`,
      position: e.position,
      department: e.department,
      contract: CONTRACT_LABELS[e.contractType],
      bank: {
        name: e.bankName,
        type: e.accountType,
        maskedAccount: account ? `****${account.slice(-4)}` : null,
      },
    },
    workedDays: p.workedDays,
    earnings: lines([
      ['Sueldo básico', p.basicSalary.amount, true],
      ['Licencias e incapacidades', p.leavePay.amount],
      ['Horas extra y recargos', p.overtime.amount],
      ['Auxilio de transporte', p.transportAllowance.amount],
      ['Bonificaciones', p.bonuses.amount],
    ]),
    deductions: lines([
      [rateLabel('Salud', params?.rates.healthEmployee), p.health.amount, true],
      [rateLabel('Pensión', params?.rates.pensionEmployee), p.pension.amount, true],
      ['Fondo de solidaridad pensional', p.solidarityFund.amount],
      ['Retención en la fuente', p.withholding.amount],
      ['Libranza', p.libranza.amount],
      ['Cuota sindical', p.sindicato.amount],
      ['Embargo judicial', p.embargo.amount],
      ['Otros descuentos', p.otherDeductions.amount],
    ]),
    grossTotal: p.gross.amount,
    deductionsTotal: p.totalDeductions.amount,
    net: p.net.amount,
    netInWords: amountInWords(p.net.amount),
    employerContributions: lines([
      ['Salud empleador', p.employerHealth.amount],
      ['Pensión empleador', p.employerPension.amount],
      ['ARL', p.arl.amount],
      ['Caja de compensación', p.ccf.amount],
      ['SENA', p.sena.amount],
      ['ICBF', p.icbf.amount],
    ]),
  };
}
