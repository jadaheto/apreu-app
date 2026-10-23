import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { ArlRiskClass } from '../employees/employee-catalogs.js';
import type { RecurringDeductions, WithholdingInfo } from '../employees/employee.js';
import { DeductionLimitPolicy } from './deduction-limit-policy.js';
import type { NoveltyType } from './payroll-novelty.js';
import type { PayrollParameters } from './payroll-parameters.js';
import { PERIOD_LENGTH_DAYS, type PayFrequency } from './pay-frequency.js';
import { WithholdingTax } from './withholding-tax.js';

/** Employee data the calculator needs; the `Employee` aggregate satisfies it structurally. */
export interface EmployeePayrollSnapshot {
  baseSalary: Money;
  integralSalary: boolean;
  arlRiskClass: ArlRiskClass;
  isContractor: boolean;
  recurringDeductions: RecurringDeductions;
  withholding: WithholdingInfo;
}

/** Commercial days of absence inside the contract window, grouped by pay treatment. */
export interface AbsenceDays {
  paid: number;
  incapacity: number;
  unpaid: number;
}

export interface PayrollCalculationContext {
  frequency: PayFrequency;
  /** Commercial days (30/360) the employee had a contract inside the period. */
  contractDays: number;
  absences: AbsenceDays;
}

export interface NoveltyAmount {
  type: NoveltyType;
  amount: Money;
}

export interface PayslipCalculation {
  contractDays: number;
  workedDays: number;
  /** Ingreso base de cotización used for social security. */
  ibc: Money;
  earnings: {
    basicSalary: Money;
    leavePay: Money;
    transportAllowance: Money;
    overtime: Money;
    salaryBonuses: Money;
    nonSalaryBonuses: Money;
    gross: Money;
  };
  deductions: {
    health: Money;
    pension: Money;
    solidarityFund: Money;
    solidarityFundRate: number;
    withholding: Money;
    embargo: Money;
    sindicato: Money;
    libranza: Money;
    other: Money;
    total: Money;
  };
  employer: {
    health: Money;
    pension: Money;
    arl: Money;
    sena: Money;
    icbf: Money;
    ccf: Money;
    total: Money;
    /** Art. 114-1 ET exemption applied (no health 8.5 %, SENA, ICBF). */
    exempted: boolean;
  };
  net: Money;
  /** Explanations of reduced deductions, for traceability. */
  notes: string[];
}

/** Incapacidad por enfermedad general: 2/3 of the salary (art. 227 CST), never below the minimum wage. */
const INCAPACITY_FACTOR = 2 / 3;
const INTEGRAL_SALARY_FACTOR = 0.7;
const NON_SALARY_LIMIT = 0.4;
const MAX_IBC_MINIMUM_WAGES = 25;
const TRANSPORT_LIMIT_MINIMUM_WAGES = 2;
const EXEMPTION_LIMIT_MINIMUM_WAGES = 10;

/**
 * Fondo de solidaridad pensional rate for an IBC expressed in minimum wages
 * (Ley 100/1993 art. 27, modified by Ley 797/2003).
 */
export const solidarityFundRate = (ibcInMinimumWages: number): number => {
  if (ibcInMinimumWages < 4) return 0;
  if (ibcInMinimumWages < 16) return 1;
  if (ibcInMinimumWages < 17) return 1.2;
  if (ibcInMinimumWages < 18) return 1.4;
  if (ibcInMinimumWages < 19) return 1.6;
  if (ibcInMinimumWages <= 20) return 1.8;
  return 2;
};

/**
 * Colombian payroll calculator — pure domain service, no I/O (analysis 07
 * §6.3). Replaces the formulas embedded in `hr/payroll.php:123-186`.
 *
 * All amounts are rounded to whole pesos per line. Rules:
 * - Basic salary proportional to commercial days actually worked; approved
 *   paid leaves at 100 %, incapacities at 2/3 (min. SMMLV), unpaid leaves at 0.
 * - Transport allowance proportional to worked days, only when the monthly
 *   salary is ≤ 2 SMMLV and the salary is not integral (L-2).
 * - IBC: salary payments (70 % for integral salary) plus the excess of
 *   non-salary payments over 40 % (Ley 1393/2010 art. 30), between 1 and 25
 *   SMMLV proportional to the contributed days (L-3).
 * - Employee health 4 %, pension 4 %, FSP by bracket (L-4).
 * - Withholding tax: procedimiento 1 with the UVT table (L-5) on the monthly
 *   equivalent of the period.
 * - Employer: health 8.5 %, pension 12 %, ARL by risk class, CCF 4 %, SENA
 *   2 %, ICBF 3 %, with the art. 114-1 ET exemption when configured (L-6, L-7).
 * - Recurring deductions are monthly and prorated by the period length;
 *   one-off novelties are taken as entered. Limits per {@link DeductionLimitPolicy}.
 *
 * Out of scope (documented): overtime computed from hours (overtime enters as
 * an amount), social benefits provisions (cesantías, prima, vacaciones), PILA
 * rounding and the DIAN electronic payroll.
 */
export const PayrollCalculator = {
  calculate(
    employee: EmployeePayrollSnapshot,
    context: PayrollCalculationContext,
    novelties: readonly NoveltyAmount[],
    params: PayrollParameters,
  ): PayslipCalculation {
    if (employee.isContractor) {
      throw new BusinessRuleViolationError(
        'Los contratistas de prestación de servicios no se liquidan en la nómina.',
        'CONTRACTOR_NOT_IN_PAYROLL',
      );
    }
    const periodLength = PERIOD_LENGTH_DAYS[context.frequency];
    const { contractDays, absences } = context;
    const absenceDays = absences.paid + absences.incapacity + absences.unpaid;
    if (contractDays < 0 || contractDays > periodLength || absenceDays > contractDays) {
      throw new BusinessRuleViolationError('Los días de la liquidación no son consistentes.', 'INVALID_PAYROLL_DAYS', {
        contractDays,
        absenceDays,
      });
    }

    const minimumWage = params.minimumWage.amount;
    const monthlySalary = employee.baseSalary.amount;
    const dailySalary = monthlySalary / 30;
    const workedDays = contractDays - absenceDays;
    const contributedDays = contractDays - absences.unpaid;
    const sum = (type: NoveltyType) =>
      novelties.filter((n) => n.type === type).reduce((total, n) => total + n.amount.amount, 0);

    // Earnings
    const basicSalary = Math.round(dailySalary * workedDays);
    const incapacityDaily = Math.max(dailySalary * INCAPACITY_FACTOR, minimumWage / 30);
    const leavePay = Math.round(dailySalary * absences.paid) + Math.round(incapacityDaily * absences.incapacity);
    const overtime = sum('overtime');
    const salaryBonuses = sum('bonus_salary');
    const nonSalaryBonuses = sum('bonus_non_salary');
    const transportEligible = !employee.integralSalary && monthlySalary <= TRANSPORT_LIMIT_MINIMUM_WAGES * minimumWage;
    const transportAllowance = transportEligible ? Math.round((params.transportAllowance.amount / 30) * workedDays) : 0;
    const salaryEarnings = basicSalary + leavePay + overtime + salaryBonuses;
    const gross = salaryEarnings + nonSalaryBonuses + transportAllowance;

    // Social security base (IBC)
    const salaryBase = employee.integralSalary ? Math.round(salaryEarnings * INTEGRAL_SALARY_FACTOR) : salaryEarnings;
    const nonSalaryLimit = (salaryEarnings + nonSalaryBonuses) * NON_SALARY_LIMIT;
    const ibcUncapped = salaryBase + Math.max(Math.round(nonSalaryBonuses - nonSalaryLimit), 0);
    const ibcMin = Math.round((minimumWage * contributedDays) / 30);
    const ibcMax = Math.round((MAX_IBC_MINIMUM_WAGES * minimumWage * contributedDays) / 30);
    const ibc = contributedDays > 0 ? Math.min(Math.max(ibcUncapped, ibcMin), ibcMax) : 0;

    // Employee contributions
    const { rates } = params;
    const health = pct(ibc, rates.healthEmployee);
    const pension = pct(ibc, rates.pensionEmployee);
    const monthlyIbc = contributedDays > 0 ? (ibc * 30) / contributedDays : 0;
    const fspRate = solidarityFundRate(monthlyIbc / minimumWage);
    const solidarityFund = pct(ibc, fspRate);

    // Withholding tax on the monthly equivalent of the period
    const monthFraction = periodLength / 30;
    const recurring = employee.recurringDeductions;
    const withholding = Math.round(
      WithholdingTax.monthly(
        {
          laborIncome: gross / monthFraction,
          mandatoryContributions: (health + pension + solidarityFund) / monthFraction,
          hasDependents: employee.withholding.hasDependents,
          prepaidHealth: employee.withholding.prepaidHealth.amount,
          housingInterest: employee.withholding.housingInterest.amount,
          voluntaryPension: employee.withholding.voluntaryPension.amount,
        },
        params.uvt.amount,
      ).amount * monthFraction,
    );

    // Other deductions with legal limits
    const prorate = (monthly: Money) => Math.round(monthly.amount * monthFraction);
    const applied = DeductionLimitPolicy.apply({
      grossPay: gross,
      salaryEarnings,
      unseizableMinimum: Math.round((minimumWage * contractDays) / 30),
      embargoIsAlimony: recurring.embargoIsAlimony,
      requested: {
        health,
        pension,
        solidarityFund,
        withholding,
        embargo: prorate(recurring.embargo) + sum('embargo'),
        sindicato: prorate(recurring.sindicato) + sum('sindicato'),
        libranza: prorate(recurring.libranza) + sum('libranza'),
        other: sum('other_deduction'),
      },
    });

    // Employer contributions
    const exempted =
      params.employerContributionExemption && monthlySalary < EXEMPTION_LIMIT_MINIMUM_WAGES * minimumWage;
    const parafiscalBase = salaryBase;
    const employer = {
      health: exempted ? 0 : pct(ibc, rates.healthEmployer),
      pension: pct(ibc, rates.pensionEmployer),
      arl: pct(ibc, rates.arl[employee.arlRiskClass]),
      sena: exempted ? 0 : pct(parafiscalBase, rates.sena),
      icbf: exempted ? 0 : pct(parafiscalBase, rates.icbf),
      ccf: pct(parafiscalBase, rates.ccf),
    };
    const employerTotal = Object.values(employer).reduce((a, b) => a + b, 0);

    return {
      contractDays,
      workedDays,
      ibc: Money.of(ibc),
      earnings: {
        basicSalary: Money.of(basicSalary),
        leavePay: Money.of(leavePay),
        transportAllowance: Money.of(transportAllowance),
        overtime: Money.of(overtime),
        salaryBonuses: Money.of(salaryBonuses),
        nonSalaryBonuses: Money.of(nonSalaryBonuses),
        gross: Money.of(gross),
      },
      deductions: {
        health: Money.of(applied.health),
        pension: Money.of(applied.pension),
        solidarityFund: Money.of(applied.solidarityFund),
        solidarityFundRate: fspRate,
        withholding: Money.of(applied.withholding),
        embargo: Money.of(applied.embargo),
        sindicato: Money.of(applied.sindicato),
        libranza: Money.of(applied.libranza),
        other: Money.of(applied.other),
        total: Money.of(applied.total),
      },
      employer: {
        health: Money.of(employer.health),
        pension: Money.of(employer.pension),
        arl: Money.of(employer.arl),
        sena: Money.of(employer.sena),
        icbf: Money.of(employer.icbf),
        ccf: Money.of(employer.ccf),
        total: Money.of(employerTotal),
        exempted,
      },
      net: Money.of(applied.net),
      notes: applied.adjustments,
    };
  },
};

function pct(base: number, rate: number): number {
  return Math.round((base * rate) / 100);
}
