import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { ArlRiskClass } from '../employees/employee-catalogs.js';

/** Contribution rates in percent (e.g. `4` = 4 %). */
export interface PayrollRates {
  healthEmployee: number;
  pensionEmployee: number;
  healthEmployer: number;
  pensionEmployer: number;
  sena: number;
  icbf: number;
  ccf: number;
  /** ARL rate per risk class I–V. */
  arl: Readonly<Record<ArlRiskClass, number>>;
}

export interface PayrollParametersProps {
  year: number;
  /** SMMLV. */
  minimumWage: Money;
  /** Auxilio de transporte mensual. */
  transportAllowance: Money;
  /** Unidad de Valor Tributario. */
  uvt: Money;
  rates: PayrollRates;
  /**
   * Exoneración de aportes (art. 114-1 ET): the school is a taxpayer legal
   * entity, so employer health 8.5 %, SENA and ICBF are not paid for workers
   * earning less than 10 SMMLV. Must be confirmed by the school's accountant.
   */
  employerContributionExemption: boolean;
}

export interface PayrollParametersInput {
  minimumWage: number;
  transportAllowance: number;
  uvt: number;
  rates?: Partial<Omit<PayrollRates, 'arl'>> & { arl?: Partial<Record<ArlRiskClass, number>> };
  employerContributionExemption?: boolean;
}

/** Statutory rates unchanged in 2025 and 2026 (Ley 100/1993, Ley 21/1982, Decreto 1772/1994). */
export const STATUTORY_RATES: PayrollRates = Object.freeze({
  healthEmployee: 4,
  pensionEmployee: 4,
  healthEmployer: 8.5,
  pensionEmployer: 12,
  sena: 2,
  icbf: 3,
  ccf: 4,
  arl: Object.freeze({ 1: 0.522, 2: 1.044, 3: 2.436, 4: 4.35, 5: 6.96 }),
});

/**
 * Legal values per year (analysis 07 §3.1, table "Valor legal"):
 * - 2025: SMMLV $1.423.500 (Decreto 1572/2024), auxilio $200.000 (Decreto 1573/2024), UVT $49.799.
 * - 2026: SMMLV $1.750.905, auxilio $249.095, UVT $52.374.
 * Used when the school has not configured the year explicitly.
 */
const LEGAL_VALUES: Readonly<Record<number, { minimumWage: number; transportAllowance: number; uvt: number }>> = {
  2025: { minimumWage: 1_423_500, transportAllowance: 200_000, uvt: 49_799 },
  2026: { minimumWage: 1_750_905, transportAllowance: 249_095, uvt: 52_374 },
};

/**
 * Legal payroll parameters of one fiscal year (analysis D-5 / L-1: versioned
 * per year instead of a single `settings` value). Every value must be
 * positive, which also fixes B-13 (an empty SMMLV produced 0).
 */
export class PayrollParameters {
  private constructor(private readonly props: PayrollParametersProps) {
    Object.freeze(this);
  }

  static create(year: number, input: PayrollParametersInput): PayrollParameters {
    Guard.inRange(year, 2000, 2100, 'año');
    const rates: PayrollRates = {
      ...STATUTORY_RATES,
      ...stripUndefined(input.rates ?? {}),
      arl: { ...STATUTORY_RATES.arl, ...stripUndefined(input.rates?.arl ?? {}) },
    };
    for (const [name, value] of Object.entries(rates)) {
      if (typeof value === 'number') Guard.inRange(value, 0, 100, `tasa ${name}`);
    }
    Object.values(rates.arl).forEach((value) => Guard.inRange(value, 0, 100, 'tasa ARL'));
    return new PayrollParameters({
      year,
      minimumWage: positive(input.minimumWage, 'SMMLV'),
      transportAllowance: positive(input.transportAllowance, 'auxilio de transporte'),
      uvt: positive(input.uvt, 'UVT'),
      rates,
      employerContributionExemption: input.employerContributionExemption ?? false,
    });
  }

  /** Built-in legal values for the year, or `null` when the year is unknown. */
  static legalDefault(year: number): PayrollParameters | null {
    const values = LEGAL_VALUES[year];
    return values ? PayrollParameters.create(year, values) : null;
  }

  get year(): number {
    return this.props.year;
  }
  get minimumWage(): Money {
    return this.props.minimumWage;
  }
  get transportAllowance(): Money {
    return this.props.transportAllowance;
  }
  get uvt(): Money {
    return this.props.uvt;
  }
  get rates(): PayrollRates {
    return this.props.rates;
  }
  get employerContributionExemption(): boolean {
    return this.props.employerContributionExemption;
  }
}

function positive(value: number, field: string): Money {
  const amount = Money.of(value);
  if (!amount.isGreaterThan(Money.zero())) {
    throw new BusinessRuleViolationError(
      `El parámetro "${field}" debe ser mayor que cero.`,
      'INVALID_PAYROLL_PARAMETER',
      {
        field,
      },
    );
  }
  return amount;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
