import { Entity, type EntityId } from '../../../../shared/domain/entity.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { PayslipCalculation } from './payroll-calculator.js';

export const PAYROLL_PAYMENT_STATUSES = ['pending', 'paid', 'cancelled'] as const;
export type PayrollPaymentStatus = (typeof PAYROLL_PAYMENT_STATUSES)[number];

export interface PayrollPaymentProps {
  periodId: number;
  employeeId: number;
  status: PayrollPaymentStatus;
  workedDays: number;
  ibc: Money;
  basicSalary: Money;
  leavePay: Money;
  transportAllowance: Money;
  overtime: Money;
  bonuses: Money;
  gross: Money;
  health: Money;
  pension: Money;
  solidarityFund: Money;
  withholding: Money;
  libranza: Money;
  sindicato: Money;
  embargo: Money;
  otherDeductions: Money;
  totalDeductions: Money;
  employerHealth: Money;
  employerPension: Money;
  arl: Money;
  sena: Money;
  icbf: Money;
  ccf: Money;
  employerTotal: Money;
  net: Money;
  notes: string[];
  createdAt: Date | null;
}

/**
 * One employee's payslip inside a payroll period (`payroll_payments`).
 * Built from a {@link PayslipCalculation}; it follows the period state and is
 * never deleted once the period is approved (payroll history must be kept).
 */
export class PayrollPayment extends Entity<PayrollPaymentProps> {
  private constructor(id: EntityId, props: PayrollPaymentProps) {
    super(id, props);
  }

  static fromCalculation(periodId: number, employeeId: number, calc: PayslipCalculation): PayrollPayment {
    const { earnings, deductions, employer } = calc;
    return new PayrollPayment(null, {
      periodId,
      employeeId,
      status: 'pending',
      workedDays: calc.workedDays,
      ibc: calc.ibc,
      basicSalary: earnings.basicSalary,
      leavePay: earnings.leavePay,
      transportAllowance: earnings.transportAllowance,
      overtime: earnings.overtime,
      bonuses: earnings.salaryBonuses.add(earnings.nonSalaryBonuses),
      gross: earnings.gross,
      health: deductions.health,
      pension: deductions.pension,
      solidarityFund: deductions.solidarityFund,
      withholding: deductions.withholding,
      libranza: deductions.libranza,
      sindicato: deductions.sindicato,
      embargo: deductions.embargo,
      otherDeductions: deductions.other,
      totalDeductions: deductions.total,
      employerHealth: employer.health,
      employerPension: employer.pension,
      arl: employer.arl,
      sena: employer.sena,
      icbf: employer.icbf,
      ccf: employer.ccf,
      employerTotal: employer.total,
      net: calc.net,
      notes: [...calc.notes],
      createdAt: null,
    });
  }

  static restore(id: number, props: PayrollPaymentProps): PayrollPayment {
    return new PayrollPayment(id, { ...props });
  }

  get periodId(): number {
    return this.props.periodId;
  }
  get employeeId(): number {
    return this.props.employeeId;
  }
  get status(): PayrollPaymentStatus {
    return this.props.status;
  }
  get workedDays(): number {
    return this.props.workedDays;
  }
  get ibc(): Money {
    return this.props.ibc;
  }
  get basicSalary(): Money {
    return this.props.basicSalary;
  }
  get leavePay(): Money {
    return this.props.leavePay;
  }
  get transportAllowance(): Money {
    return this.props.transportAllowance;
  }
  get overtime(): Money {
    return this.props.overtime;
  }
  get bonuses(): Money {
    return this.props.bonuses;
  }
  get gross(): Money {
    return this.props.gross;
  }
  get health(): Money {
    return this.props.health;
  }
  get pension(): Money {
    return this.props.pension;
  }
  get solidarityFund(): Money {
    return this.props.solidarityFund;
  }
  get withholding(): Money {
    return this.props.withholding;
  }
  get libranza(): Money {
    return this.props.libranza;
  }
  get sindicato(): Money {
    return this.props.sindicato;
  }
  get embargo(): Money {
    return this.props.embargo;
  }
  get otherDeductions(): Money {
    return this.props.otherDeductions;
  }
  get totalDeductions(): Money {
    return this.props.totalDeductions;
  }
  get employerHealth(): Money {
    return this.props.employerHealth;
  }
  get employerPension(): Money {
    return this.props.employerPension;
  }
  get arl(): Money {
    return this.props.arl;
  }
  get sena(): Money {
    return this.props.sena;
  }
  get icbf(): Money {
    return this.props.icbf;
  }
  get ccf(): Money {
    return this.props.ccf;
  }
  get employerTotal(): Money {
    return this.props.employerTotal;
  }
  get net(): Money {
    return this.props.net;
  }
  get notes(): string[] {
    return [...this.props.notes];
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  markPaid(): void {
    if (this.props.status === 'pending') this.props.status = 'paid';
  }

  cancel(): void {
    if (this.props.status === 'pending') this.props.status = 'cancelled';
  }
}

/** Sums the period totals reported on `payroll_periods`. */
export const sumPayrollTotals = (payments: readonly PayrollPayment[]) =>
  payments.reduce(
    (acc, p) => ({
      gross: acc.gross.add(p.gross),
      deductions: acc.deductions.add(p.totalDeductions),
      net: acc.net.add(p.net),
      employerCost: acc.employerCost.add(p.employerTotal),
    }),
    { gross: Money.zero(), deductions: Money.zero(), net: Money.zero(), employerCost: Money.zero() },
  );
