import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { AbsenceDaysCalculator } from './absence-days.js';
import { DeductionLimitPolicy, type RequestedDeductions } from './deduction-limit-policy.js';
import { PayrollNovelty } from './payroll-novelty.js';
import { PayrollParameters } from './payroll-parameters.js';
import { WithholdingTax } from './withholding-tax.js';

const UVT = 52_374;
const none: RequestedDeductions = {
  health: 0,
  pension: 0,
  solidarityFund: 0,
  withholding: 0,
  embargo: 0,
  sindicato: 0,
  libranza: 0,
  other: 0,
};

describe('PayrollParameters', () => {
  it('ships the legal 2025 and 2026 values', () => {
    const p2026 = PayrollParameters.legalDefault(2026) as PayrollParameters;
    expect(p2026.minimumWage.amount).toBe(1_750_905);
    expect(p2026.transportAllowance.amount).toBe(249_095);
    expect(p2026.uvt.amount).toBe(52_374);
    expect(PayrollParameters.legalDefault(2025)?.minimumWage.amount).toBe(1_423_500);
    expect(PayrollParameters.legalDefault(2025)?.transportAllowance.amount).toBe(200_000);
    expect(PayrollParameters.legalDefault(1999)).toBeNull();
  });

  it('merges custom rates with the statutory ones', () => {
    const params = PayrollParameters.create(2027, {
      minimumWage: 2_000_000,
      transportAllowance: 280_000,
      uvt: 55_000,
      rates: { ccf: 3, arl: { 1: 0.6 } },
    });
    expect(params.rates).toMatchObject({ ccf: 3, healthEmployee: 4, arl: { 1: 0.6, 5: 6.96 } });
    expect(params.employerContributionExemption).toBe(false);
  });

  it.each([
    [{ minimumWage: 0 }, 'INVALID_PAYROLL_PARAMETER'],
    [{ uvt: -1 }, 'INVALID_PAYROLL_PARAMETER'],
    [{ rates: { sena: 120 } }, 'OUT_OF_RANGE'],
  ])('rejects invalid values %o', (override, code) => {
    expect(() =>
      PayrollParameters.create(2026, { minimumWage: 1, transportAllowance: 1, uvt: 1, ...override }),
    ).toThrow(expect.objectContaining({ code }));
  });
});

describe('WithholdingTax (procedimiento 1)', () => {
  const base = {
    mandatoryContributions: 0,
    hasDependents: false,
    prepaidHealth: 0,
    housingInterest: 0,
    voluntaryPension: 0,
  };

  it('does not withhold when the cleaned base is up to 95 UVT', () => {
    expect(WithholdingTax.monthly({ ...base, laborIncome: 6_000_000 }, UVT).amount).toBe(0);
  });

  it('applies the 19 % bracket above 95 UVT', () => {
    const result = WithholdingTax.monthly({ ...base, laborIncome: 8_000_000, mandatoryContributions: 640_000 }, UVT);
    // net 7.360.000 − 25 % (1.840.000) = 5.520.000
    expect(result.taxableBase).toBe(5_520_000);
    expect(result.amount).toBe(Math.round((5_520_000 / UVT - 95) * 0.19 * UVT));
  });

  it('limits dependents, prepaid health and the global 40 %', () => {
    const result = WithholdingTax.monthly(
      { ...base, laborIncome: 10_000_000, hasDependents: true, prepaidHealth: 5_000_000, housingInterest: 10_000_000 },
      UVT,
    );
    // deductions are capped by the 40 % global limit
    expect(result.taxableBase).toBe(6_000_000);
  });
});

describe('DeductionLimitPolicy', () => {
  it('keeps statutory deductions first and never returns a negative net', () => {
    const result = DeductionLimitPolicy.apply({
      grossPay: 100_000,
      salaryEarnings: 100_000,
      unseizableMinimum: 0,
      embargoIsAlimony: false,
      requested: { ...none, health: 80_000, pension: 80_000 },
    });
    expect(result).toMatchObject({ health: 80_000, pension: 20_000, net: 0 });
    expect(result.adjustments[0]).toContain('Pensión');
  });

  it('limits ordinary embargo to 1/5 of the excess over the minimum wage', () => {
    const result = DeductionLimitPolicy.apply({
      grossPay: 3_000_000,
      salaryEarnings: 3_000_000,
      unseizableMinimum: 1_000_000,
      embargoIsAlimony: false,
      requested: { ...none, embargo: 1_000_000 },
    });
    expect(result.embargo).toBe(400_000);
  });

  it('allows alimony embargo up to 50 % of the salary after statutory deductions', () => {
    const result = DeductionLimitPolicy.apply({
      grossPay: 3_000_000,
      salaryEarnings: 3_000_000,
      unseizableMinimum: 1_000_000,
      embargoIsAlimony: true,
      requested: { ...none, health: 120_000, pension: 120_000, embargo: 2_000_000 },
    });
    expect(result.embargo).toBe(1_380_000);
  });

  it('protects 50 % of the net salary from libranzas and other deductions', () => {
    const result = DeductionLimitPolicy.apply({
      grossPay: 2_000_000,
      salaryEarnings: 2_000_000,
      unseizableMinimum: 1_000_000,
      embargoIsAlimony: false,
      requested: { ...none, libranza: 700_000, other: 700_000 },
    });
    expect(result).toMatchObject({ libranza: 700_000, other: 300_000, net: 1_000_000 });
  });
});

describe('AbsenceDaysCalculator', () => {
  const window = { from: '2026-03-01', to: '2026-03-31' };

  it('groups commercial days by pay treatment inside the window', () => {
    const days = AbsenceDaysCalculator.forWindow(window, 30, [
      { startDate: '2026-02-25', endDate: '2026-03-05', payTreatment: 'incapacity' },
      { startDate: '2026-03-20', endDate: '2026-03-31', payTreatment: 'paid' },
      { startDate: '2026-03-10', endDate: '2026-03-12', payTreatment: 'worked' },
      { startDate: '2026-03-13', endDate: '2026-03-14', payTreatment: 'unpaid' },
    ]);
    expect(days).toEqual({ incapacity: 5, paid: 11, unpaid: 2 });
  });

  it('never exceeds the contract days', () => {
    const days = AbsenceDaysCalculator.forWindow(window, 30, [
      { startDate: '2026-03-01', endDate: '2026-03-31', payTreatment: 'paid' },
      { startDate: '2026-03-01', endDate: '2026-03-31', payTreatment: 'unpaid' },
    ]);
    expect(days).toEqual({ paid: 30, incapacity: 0, unpaid: 0 });
  });
});

describe('PayrollNovelty', () => {
  it('creates a novelty with a positive amount', () => {
    const novelty = PayrollNovelty.create({
      periodId: 1,
      employeeId: 2,
      type: 'libranza',
      amount: 50_000,
      createdBy: 3,
    });
    expect(novelty.amount.equals(Money.of(50_000))).toBe(true);
    expect(novelty.description).toBeNull();
  });

  it.each([
    [{ amount: 0 }, 'INVALID_AMOUNT'],
    [{ type: 'propina' }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() =>
      PayrollNovelty.create({
        periodId: 1,
        employeeId: 2,
        type: 'libranza',
        amount: 1,
        createdBy: 3,
        ...(override as object),
      }),
    ).toThrow(expect.objectContaining({ code }));
  });
});
