/** Monthly inputs (pesos) for the labour-income withholding tax. */
export interface WithholdingInput {
  /** Total labour payments of the month (salary, leave pay, bonuses, transport allowance). */
  laborIncome: number;
  /** Ingresos no constitutivos de renta: mandatory health + pension + FSP contributions. */
  mandatoryContributions: number;
  hasDependents: boolean;
  prepaidHealth: number;
  housingInterest: number;
  /** Aportes voluntarios a pensión / AFC (renta exenta). */
  voluntaryPension: number;
}

export interface WithholdingResult {
  /** Base gravable depurada in pesos. */
  taxableBase: number;
  baseInUvt: number;
  /** Retention in pesos (rounded to the peso). */
  amount: number;
}

/** Marginal table of art. 383 ET: [lower bound UVT, marginal rate, fixed UVT]. */
const TABLE: readonly (readonly [number, number, number])[] = [
  [2300, 0.39, 770],
  [945, 0.37, 268],
  [640, 0.35, 162],
  [360, 0.33, 69],
  [150, 0.28, 10],
  [95, 0.19, 0],
];

const MONTHLY_CAPS_UVT = {
  dependents: 32,
  prepaidHealth: 16,
  housingInterest: 100,
  /** 790 UVT per year for the 25 % exempt income. */
  exempt25: 790 / 12,
  /** 1.340 UVT per year for deductions + exempt income. */
  globalLimit: 1340 / 12,
};

/**
 * Retención en la fuente por pagos laborales — **procedimiento 1** (arts. 383,
 * 387, 388 y 336 ET) on a monthly basis. Replaces the legacy flat 7 % above
 * 4 SMMLV (analysis L-5).
 *
 * Scope:
 * - Deductions: dependents (10 % of income, max 32 UVT), prepaid health
 *   (max 16 UVT) and housing interest (max 100 UVT).
 * - Exempt income: voluntary pension/AFC (max 30 % of income) and the 25 %
 *   labour exemption (max 790 UVT/year).
 * - Global limit: deductions + exempt income ≤ 40 % of net income and
 *   ≤ 1.340 UVT/year.
 * - Not covered: procedimiento 2 (semiannual percentage), severance
 *   payments (cesantías) and the annual reconciliation; the school's
 *   accountant must review those cases.
 */
export const WithholdingTax = {
  monthly(input: WithholdingInput, uvt: number): WithholdingResult {
    const income = Math.max(input.laborIncome, 0);
    const netIncome = Math.max(income - input.mandatoryContributions, 0);

    const deductions =
      (input.hasDependents ? Math.min(income * 0.1, MONTHLY_CAPS_UVT.dependents * uvt) : 0) +
      Math.min(input.prepaidHealth, MONTHLY_CAPS_UVT.prepaidHealth * uvt) +
      Math.min(input.housingInterest, MONTHLY_CAPS_UVT.housingInterest * uvt);
    const voluntaryExempt = Math.min(input.voluntaryPension, income * 0.3);

    const subtotal = Math.max(netIncome - deductions - voluntaryExempt, 0);
    const exempt25 = Math.min(subtotal * 0.25, MONTHLY_CAPS_UVT.exempt25 * uvt);

    const globalLimit = Math.min(netIncome * 0.4, MONTHLY_CAPS_UVT.globalLimit * uvt);
    const benefits = Math.min(deductions + voluntaryExempt + exempt25, globalLimit);

    const taxableBase = Math.max(netIncome - benefits, 0);
    const baseInUvt = taxableBase / uvt;
    const bracket = TABLE.find(([lower]) => baseInUvt > lower);
    const taxInUvt = bracket ? (baseInUvt - bracket[0]) * bracket[1] + bracket[2] : 0;
    return { taxableBase: Math.round(taxableBase), baseInUvt, amount: Math.round(taxInUvt * uvt) };
  },
};
