import type { Employee } from '../../domain/employees/employee.js';
import type { PayFrequency } from '../../domain/payroll/pay-frequency.js';
import type { PayrollParameters, PayrollRates } from '../../domain/payroll/payroll-parameters.js';
import type { NoveltyType, PayrollNovelty } from '../../domain/payroll/payroll-novelty.js';
import type { PayrollPayment, PayrollPaymentStatus } from '../../domain/payroll/payroll-payment.js';
import type { PayrollPeriod, PayrollPeriodStatus } from '../../domain/payroll/payroll-period.js';
import type { PayslipSummary } from '../../domain/payroll/payroll.repositories.js';
import type { PayrollParametersSource } from './payroll-parameters.provider.js';

export interface PayrollPeriodView {
  id: number;
  name: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  paymentDate: string;
  frequency: PayFrequency;
  year: number;
  status: PayrollPeriodStatus;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  calculatedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date | null;
}

export interface PayrollPaymentView {
  id: number;
  periodId: number;
  employeeId: number;
  employeeCode: string | null;
  employeeName: string | null;
  documentNumber: string | null;
  status: PayrollPaymentStatus;
  workedDays: number;
  ibc: number;
  earnings: {
    basicSalary: number;
    leavePay: number;
    transportAllowance: number;
    overtime: number;
    bonuses: number;
    gross: number;
  };
  deductions: {
    health: number;
    pension: number;
    solidarityFund: number;
    withholding: number;
    libranza: number;
    sindicato: number;
    embargo: number;
    other: number;
    total: number;
  };
  employer: { health: number; pension: number; arl: number; sena: number; icbf: number; ccf: number; total: number };
  net: number;
  notes: string[];
}

export interface PayrollNoveltyView {
  id: number;
  employeeId: number;
  employeeName: string | null;
  type: NoveltyType;
  amount: number;
  description: string | null;
  createdAt: Date | null;
}

export interface PayrollPeriodDetailView {
  period: PayrollPeriodView;
  payments: PayrollPaymentView[];
  novelties: PayrollNoveltyView[];
  /** Informative employer cost (contributions); not part of the period totals. */
  employerCostTotal: number;
}

export interface PayslipSummaryView {
  paymentId: number;
  periodId: number;
  periodName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  paymentDate: string | null;
  gross: number;
  totalDeductions: number;
  net: number;
  status: PayrollPaymentStatus;
}

export interface PayrollParametersView {
  year: number;
  source: PayrollParametersSource;
  minimumWage: number;
  transportAllowance: number;
  uvt: number;
  rates: PayrollRates;
  employerContributionExemption: boolean;
}

export const toPayrollPeriodView = (p: PayrollPeriod): PayrollPeriodView => ({
  id: p.id as number,
  name: p.name,
  periodLabel: p.periodLabel,
  startDate: p.startDate,
  endDate: p.endDate,
  paymentDate: p.paymentDate,
  frequency: p.frequency,
  year: p.year,
  status: p.status,
  grossTotal: p.totals.gross.amount,
  deductionsTotal: p.totals.deductions.amount,
  netTotal: p.totals.net.amount,
  calculatedAt: p.calculatedAt,
  approvedAt: p.approvedAt,
  paidAt: p.paidAt,
  cancellationReason: p.cancellationReason,
  createdAt: p.createdAt,
});

export const toPayrollPaymentView = (p: PayrollPayment, employee?: Employee | null): PayrollPaymentView => ({
  id: p.id as number,
  periodId: p.periodId,
  employeeId: p.employeeId,
  employeeCode: employee?.code ?? null,
  employeeName: employee?.fullName ?? null,
  documentNumber: employee?.documentNumber ?? null,
  status: p.status,
  workedDays: p.workedDays,
  ibc: p.ibc.amount,
  earnings: {
    basicSalary: p.basicSalary.amount,
    leavePay: p.leavePay.amount,
    transportAllowance: p.transportAllowance.amount,
    overtime: p.overtime.amount,
    bonuses: p.bonuses.amount,
    gross: p.gross.amount,
  },
  deductions: {
    health: p.health.amount,
    pension: p.pension.amount,
    solidarityFund: p.solidarityFund.amount,
    withholding: p.withholding.amount,
    libranza: p.libranza.amount,
    sindicato: p.sindicato.amount,
    embargo: p.embargo.amount,
    other: p.otherDeductions.amount,
    total: p.totalDeductions.amount,
  },
  employer: {
    health: p.employerHealth.amount,
    pension: p.employerPension.amount,
    arl: p.arl.amount,
    sena: p.sena.amount,
    icbf: p.icbf.amount,
    ccf: p.ccf.amount,
    total: p.employerTotal.amount,
  },
  net: p.net.amount,
  notes: p.notes,
});

export const toPayrollNoveltyView = (n: PayrollNovelty, employeeName: string | null): PayrollNoveltyView => ({
  id: n.id as number,
  employeeId: n.employeeId,
  employeeName,
  type: n.type,
  amount: n.amount.amount,
  description: n.description,
  createdAt: n.createdAt,
});

export const toPayslipSummaryView = (s: PayslipSummary): PayslipSummaryView => ({
  paymentId: s.paymentId,
  periodId: s.periodId,
  periodName: s.periodName,
  periodLabel: s.periodLabel,
  startDate: s.startDate,
  endDate: s.endDate,
  paymentDate: s.paymentDate,
  gross: s.gross.amount,
  totalDeductions: s.totalDeductions.amount,
  net: s.net.amount,
  status: s.status,
});

export const toPayrollParametersView = (
  p: PayrollParameters,
  source: PayrollParametersSource,
): PayrollParametersView => ({
  year: p.year,
  source,
  minimumWage: p.minimumWage.amount,
  transportAllowance: p.transportAllowance.amount,
  uvt: p.uvt.amount,
  rates: p.rates,
  employerContributionExemption: p.employerContributionExemption,
});
