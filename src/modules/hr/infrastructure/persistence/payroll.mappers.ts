import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { PAY_FREQUENCIES } from '../../domain/payroll/pay-frequency.js';
import { PayrollParameters, type PayrollParametersInput } from '../../domain/payroll/payroll-parameters.js';
import { NOVELTY_TYPES, PayrollNovelty } from '../../domain/payroll/payroll-novelty.js';
import { PAYROLL_PAYMENT_STATUSES, PayrollPayment } from '../../domain/payroll/payroll-payment.js';
import { PayrollPeriod, type PayrollPeriodStatus } from '../../domain/payroll/payroll-period.js';
import { enumValue } from './enum-value.js';
import { PayrollNoveltyOrmEntity } from './payroll-novelty.orm-entity.js';
import { PayrollParametersOrmEntity } from './payroll-parameters.orm-entity.js';
import { PayrollPaymentOrmEntity } from './payroll-payment.orm-entity.js';
import { PayrollPeriodOrmEntity } from './payroll-period.orm-entity.js';

/** Legacy states `open`/`closed` were never used; they map to the new machine (analysis §6.7). */
const LEGACY_PERIOD_STATUS: Record<string, PayrollPeriodStatus> = {
  draft: 'draft',
  open: 'draft',
  calculated: 'calculated',
  closed: 'approved',
  approved: 'approved',
  paid: 'paid',
  cancelled: 'cancelled',
};

export const PayrollPeriodMapper = {
  toDomain(row: PayrollPeriodOrmEntity): PayrollPeriod {
    return PayrollPeriod.restore(row.id, {
      name: row.name,
      startDate: row.periodStart,
      endDate: row.periodEnd,
      paymentDate: row.paymentDate ?? row.periodEnd,
      frequency: enumValue(row.frequency, PAY_FREQUENCIES, 'monthly'),
      status: LEGACY_PERIOD_STATUS[row.status ?? 'draft'] ?? 'draft',
      totals: {
        gross: Money.of(row.totalGross),
        deductions: Money.of(row.totalDeductions),
        net: Money.of(row.totalNet),
      },
      periodLabel: row.periodLabel ?? row.name,
      year: row.year ?? CalendarDate.parts(row.periodStart).year,
      createdBy: row.createdBy,
      calculatedBy: row.calculatedBy,
      calculatedAt: row.calculatedAt,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      paidAt: row.paidAt,
      cancelledAt: row.cancelledAt,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt,
    });
  },

  toPersistence(p: PayrollPeriod): PayrollPeriodOrmEntity {
    const row = new PayrollPeriodOrmEntity();
    if (p.id !== null) row.id = p.id;
    const totals = p.totals;
    Object.assign(row, {
      name: p.name,
      periodStart: p.startDate,
      periodEnd: p.endDate,
      paymentDate: p.paymentDate,
      frequency: p.frequency,
      totalGross: totals.gross.amount,
      totalDeductions: totals.deductions.amount,
      totalNet: totals.net.amount,
      status: p.status,
      periodLabel: p.periodLabel,
      year: p.year,
      createdBy: p.createdBy,
      calculatedBy: p.calculatedBy,
      calculatedAt: p.calculatedAt,
      approvedBy: p.approvedBy,
      approvedAt: p.approvedAt,
      paidAt: p.paidAt,
      cancelledAt: p.cancelledAt,
      cancellationReason: p.cancellationReason,
    });
    return row;
  },
};

export const PayrollPaymentMapper = {
  toDomain(row: PayrollPaymentOrmEntity): PayrollPayment {
    return PayrollPayment.restore(row.id, {
      periodId: row.payrollPeriodId,
      employeeId: row.employeeId,
      status: enumValue(row.status, PAYROLL_PAYMENT_STATUSES, 'pending'),
      workedDays: row.workedDays,
      ibc: Money.of(row.ibc),
      basicSalary: Money.of(row.baseSalary),
      leavePay: Money.of(row.leavePay),
      transportAllowance: Money.of(row.transportAllowance),
      overtime: Money.of(row.overtimePay),
      bonuses: Money.of(row.bonuses),
      gross: Money.of(row.grossSalary),
      health: Money.of(row.healthDeduction),
      pension: Money.of(row.pensionDeduction),
      solidarityFund: Money.of(row.solidarityFundDeduction),
      // Legacy rows duplicated the withholding in `income_tax` and `retefuente` (B-16).
      withholding: Money.of(Math.max(row.retefuente, row.incomeTax)),
      libranza: Money.of(row.libranzaDeduction),
      sindicato: Money.of(row.sindicatoDeduction),
      embargo: Money.of(row.embargoDeduction),
      otherDeductions: Money.of(row.otherDeductions),
      totalDeductions: Money.of(row.totalDeductions),
      employerHealth: Money.of(row.employerHealth),
      employerPension: Money.of(row.employerPension),
      arl: Money.of(row.arlContribution),
      sena: Money.of(row.senaContribution),
      icbf: Money.of(row.icbfContribution),
      ccf: Money.of(row.ccfContribution),
      employerTotal: Money.of(row.totalEmployerCost),
      net: Money.of(row.netSalary),
      notes: row.calculationNotes ?? [],
      createdAt: row.createdAt,
    });
  },

  toPersistence(p: PayrollPayment): PayrollPaymentOrmEntity {
    const row = new PayrollPaymentOrmEntity();
    if (p.id !== null) row.id = p.id;
    Object.assign(row, {
      employeeId: p.employeeId,
      payrollPeriodId: p.periodId,
      workedDays: p.workedDays,
      ibc: p.ibc.amount,
      baseSalary: p.basicSalary.amount,
      leavePay: p.leavePay.amount,
      transportAllowance: p.transportAllowance.amount,
      overtimePay: p.overtime.amount,
      bonuses: p.bonuses.amount,
      grossSalary: p.gross.amount,
      pensionDeduction: p.pension.amount,
      healthDeduction: p.health.amount,
      solidarityFundDeduction: p.solidarityFund.amount,
      libranzaDeduction: p.libranza.amount,
      sindicatoDeduction: p.sindicato.amount,
      embargoDeduction: p.embargo.amount,
      otherDeductions: p.otherDeductions.amount,
      incomeTax: 0,
      retefuente: p.withholding.amount,
      senaContribution: p.sena.amount,
      icbfContribution: p.icbf.amount,
      ccfContribution: p.ccf.amount,
      arlContribution: p.arl.amount,
      employerHealth: p.employerHealth.amount,
      employerPension: p.employerPension.amount,
      totalEmployerCost: p.employerTotal.amount,
      totalDeductions: p.totalDeductions.amount,
      netSalary: p.net.amount,
      status: p.status,
      calculationNotes: p.notes,
    });
    return row;
  },
};

export const PayrollNoveltyMapper = {
  toDomain(row: PayrollNoveltyOrmEntity): PayrollNovelty {
    return PayrollNovelty.restore(row.id, {
      periodId: row.payrollPeriodId,
      employeeId: row.employeeId,
      type: enumValue(row.type, NOVELTY_TYPES, 'other_deduction'),
      amount: Money.of(row.amount),
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  },

  toPersistence(n: PayrollNovelty): PayrollNoveltyOrmEntity {
    const row = new PayrollNoveltyOrmEntity();
    if (n.id !== null) row.id = n.id;
    Object.assign(row, {
      payrollPeriodId: n.periodId,
      employeeId: n.employeeId,
      type: n.type,
      amount: n.amount.amount,
      description: n.description,
      createdBy: n.createdBy,
    });
    return row;
  },
};

export const PayrollParametersMapper = {
  toDomain(row: PayrollParametersOrmEntity): PayrollParameters {
    return PayrollParameters.create(row.year, {
      minimumWage: row.minimumWage,
      transportAllowance: row.transportAllowance,
      uvt: row.uvt,
      rates: row.rates as PayrollParametersInput['rates'],
      employerContributionExemption: row.employerContributionExemption,
    });
  },

  toPersistence(p: PayrollParameters, updatedBy: number): PayrollParametersOrmEntity {
    const row = new PayrollParametersOrmEntity();
    Object.assign(row, {
      year: p.year,
      minimumWage: p.minimumWage.amount,
      transportAllowance: p.transportAllowance.amount,
      uvt: p.uvt.amount,
      rates: p.rates,
      employerContributionExemption: p.employerContributionExemption,
      updatedBy,
    });
    return row;
  },
};
