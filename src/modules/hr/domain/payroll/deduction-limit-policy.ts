import { Money } from '../../../../shared/domain/value-objects/money.vo.js';

/** Deductions requested for a payslip, in pesos. */
export interface RequestedDeductions {
  health: number;
  pension: number;
  solidarityFund: number;
  withholding: number;
  embargo: number;
  sindicato: number;
  libranza: number;
  other: number;
}

export interface DeductionLimitInput {
  /** Total devengado (salary + leave pay + bonuses + transport allowance). */
  grossPay: number;
  /** Salary payments (base for garnishments). */
  salaryEarnings: number;
  /** Minimum wage proportional to the contract days (unseizable portion). */
  unseizableMinimum: number;
  embargoIsAlimony: boolean;
  requested: RequestedDeductions;
}

export interface AppliedDeductions extends RequestedDeductions {
  total: number;
  net: number;
  /** Human readable notes for every reduced deduction (shown on the payslip detail). */
  adjustments: string[];
}

const LABELS: Record<keyof RequestedDeductions, string> = {
  health: 'Salud',
  pension: 'Pensión',
  solidarityFund: 'Fondo de solidaridad pensional',
  withholding: 'Retención en la fuente',
  embargo: 'Embargo',
  sindicato: 'Cuota sindical',
  libranza: 'Libranza',
  other: 'Otros descuentos',
};

/**
 * Applies the legal priority and limits of payroll deductions so the net pay
 * is never negative (fixes legacy B-11 / L-11):
 *
 * 1. Statutory deductions (health, pension, FSP, withholding).
 * 2. Embargo: ordinary garnishments take at most 1/5 of the salary above the
 *    minimum wage (arts. 154-155 CST); alimony up to 50 % (art. 156 CST).
 * 3. Cuota sindical (art. 400 CST).
 * 4. Libranza and other voluntary deductions: the worker keeps at least 50 %
 *    of the net salary after statutory deductions (art. 149 CST, Ley 1527/2012).
 *
 * Every step is also capped by what is left, so `net >= 0` always holds.
 */
export const DeductionLimitPolicy = {
  apply(input: DeductionLimitInput): AppliedDeductions {
    const adjustments: string[] = [];
    let remaining = Math.max(input.grossPay, 0);
    const take = (key: keyof RequestedDeductions, cap: number, reason: string): number => {
      const requested = Math.max(input.requested[key], 0);
      const applied = Math.max(Math.min(requested, cap, remaining), 0);
      if (applied < requested) {
        adjustments.push(
          `${LABELS[key]} reducido de ${Money.of(requested).format()} a ${Money.of(applied).format()}: ${reason}.`,
        );
      }
      remaining -= applied;
      return applied;
    };

    const noFunds = 'el devengado del período no alcanza';
    const health = take('health', Infinity, noFunds);
    const pension = take('pension', Infinity, noFunds);
    const solidarityFund = take('solidarityFund', Infinity, noFunds);
    const withholding = take('withholding', Infinity, noFunds);
    const netAfterLaw = remaining;
    const statutory = health + pension + solidarityFund + withholding;

    const embargoCap = input.embargoIsAlimony
      ? Math.floor(Math.max(input.salaryEarnings - statutory, 0) * 0.5)
      : Math.floor(Math.max(input.salaryEarnings - input.unseizableMinimum, 0) / 5);
    const embargo = take(
      'embargo',
      embargoCap,
      input.embargoIsAlimony
        ? 'el embargo por alimentos no puede superar el 50 % del salario (art. 156 CST)'
        : 'solo es embargable la quinta parte del excedente del salario mínimo (art. 155 CST)',
    );
    const sindicato = take('sindicato', Infinity, noFunds);

    let voluntaryRoom = Math.max(remaining - Math.ceil(netAfterLaw * 0.5), 0);
    const limitReason = 'el trabajador debe recibir al menos el 50 % de su salario neto (Ley 1527 de 2012)';
    const libranza = take('libranza', voluntaryRoom, limitReason);
    voluntaryRoom -= libranza;
    const other = take('other', voluntaryRoom, limitReason);

    const total = statutory + embargo + sindicato + libranza + other;
    return {
      health,
      pension,
      solidarityFund,
      withholding,
      embargo,
      sindicato,
      libranza,
      other,
      total,
      net: input.grossPay - total,
      adjustments,
    };
  },
};
