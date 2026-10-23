import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import type { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { IsoDate } from '../common/calendar-date.js';
import type { PayrollNovelty } from './payroll-novelty.js';
import type { PayrollPayment, PayrollPaymentStatus } from './payroll-payment.js';
import type { PayrollPeriod, PayrollPeriodStatus } from './payroll-period.js';

export interface PayrollPeriodCriteria {
  year?: number;
  status?: PayrollPeriodStatus;
}

/** Output port for {@link PayrollPeriod}. Periods are cancelled, never deleted. */
export interface PayrollPeriodRepository {
  findById(id: number): Promise<PayrollPeriod | null>;
  findByIds(ids: number[]): Promise<PayrollPeriod[]>;
  /** Newest first. */
  search(criteria: PayrollPeriodCriteria, page: PageRequest): Promise<Paginated<PayrollPeriod>>;
  /** Non-cancelled periods overlapping the range (double-payment guard, B-10). */
  findOverlapping(start: IsoDate, end: IsoDate, excludeId?: number): Promise<PayrollPeriod[]>;
  existsPaidInYear(year: number): Promise<boolean>;
  save(period: PayrollPeriod): Promise<void>;
}

/** Payslip header used by lists ("my payslips", employee history). */
export interface PayslipSummary {
  paymentId: number;
  periodId: number;
  periodName: string;
  periodLabel: string;
  startDate: IsoDate;
  endDate: IsoDate;
  paymentDate: IsoDate | null;
  gross: Money;
  totalDeductions: Money;
  net: Money;
  status: PayrollPaymentStatus;
}

export interface PayrollMonthKpis {
  employees: number;
  gross: Money;
  deductions: Money;
  net: Money;
}

/** Yearly totals of paid payslips (income and withholding certificate). */
export interface AnnualPayrollTotals {
  payments: number;
  gross: Money;
  health: Money;
  pension: Money;
  solidarityFund: Money;
  withholding: Money;
  net: Money;
}

/** Output port for {@link PayrollPayment}. */
export interface PayrollPaymentRepository {
  findById(id: number): Promise<PayrollPayment | null>;
  findByPeriod(periodId: number): Promise<PayrollPayment[]>;
  /**
   * Replaces the payslips of a period that is still editable (draft or
   * calculated). Never used on approved or paid periods.
   */
  replaceForPeriod(periodId: number, payments: PayrollPayment[]): Promise<void>;
  /** Persists status changes. */
  saveAll(payments: PayrollPayment[]): Promise<void>;
  /** Payslips of an employee, newest first; `onlyReleased` hides draft/cancelled periods. */
  listForEmployee(employeeId: number, onlyReleased: boolean, page: PageRequest): Promise<Paginated<PayslipSummary>>;
  /** KPIs of the non-cancelled periods starting in the month (legacy rule 20). */
  monthKpis(year: number, month: number): Promise<PayrollMonthKpis>;
  annualTotals(employeeId: number, year: number): Promise<AnnualPayrollTotals>;
}

/** Output port for {@link PayrollNovelty}. */
export interface PayrollNoveltyRepository {
  findById(id: number): Promise<PayrollNovelty | null>;
  findByPeriod(periodId: number): Promise<PayrollNovelty[]>;
  save(novelty: PayrollNovelty): Promise<void>;
  /** Novelties are working data of an editable period, so they can be removed. */
  delete(id: number): Promise<void>;
}

export const PAYROLL_PERIOD_REPOSITORY = Symbol('PayrollPeriodRepository');
export const PAYROLL_PAYMENT_REPOSITORY = Symbol('PayrollPaymentRepository');
export const PAYROLL_NOVELTY_REPOSITORY = Symbol('PayrollNoveltyRepository');
