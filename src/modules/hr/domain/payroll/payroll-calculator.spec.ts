import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { PayrollCalculator, solidarityFundRate, type EmployeePayrollSnapshot } from './payroll-calculator.js';
import { PayrollParameters } from './payroll-parameters.js';

const params2026 = PayrollParameters.legalDefault(2026) as PayrollParameters;
const SMMLV = 1_750_905;

const employee = (overrides: Partial<EmployeePayrollSnapshot> = {}): EmployeePayrollSnapshot => ({
  baseSalary: Money.of(SMMLV),
  integralSalary: false,
  arlRiskClass: 1,
  isContractor: false,
  recurringDeductions: {
    libranza: Money.zero(),
    sindicato: Money.zero(),
    embargo: Money.zero(),
    embargoIsAlimony: false,
  },
  withholding: {
    hasDependents: false,
    prepaidHealth: Money.zero(),
    housingInterest: Money.zero(),
    voluntaryPension: Money.zero(),
  },
  ...overrides,
});
const fullMonth = { frequency: 'monthly' as const, contractDays: 30, absences: { paid: 0, incapacity: 0, unpaid: 0 } };

describe('PayrollCalculator', () => {
  it('liquidates a minimum wage employee for a full month (2026 values)', () => {
    const result = PayrollCalculator.calculate(employee(), fullMonth, [], params2026);

    expect(result.earnings.basicSalary.amount).toBe(1_750_905);
    expect(result.earnings.transportAllowance.amount).toBe(249_095);
    expect(result.earnings.gross.amount).toBe(2_000_000);
    expect(result.ibc.amount).toBe(1_750_905);
    expect(result.deductions.health.amount).toBe(70_036);
    expect(result.deductions.pension.amount).toBe(70_036);
    expect(result.deductions.solidarityFund.amount).toBe(0);
    expect(result.deductions.withholding.amount).toBe(0);
    expect(result.net.amount).toBe(1_859_928);
    expect(result.employer).toMatchObject({ exempted: false });
    expect(result.employer.health.amount).toBe(148_827);
    expect(result.employer.pension.amount).toBe(210_109);
    expect(result.employer.arl.amount).toBe(9_140);
    expect(result.employer.sena.amount).toBe(35_018);
    expect(result.employer.icbf.amount).toBe(52_527);
    expect(result.employer.ccf.amount).toBe(70_036);
    expect(result.employer.total.amount).toBe(525_657);
  });

  it('applies the art. 114-1 exemption for salaries under 10 SMMLV', () => {
    const exempt = PayrollParameters.create(2026, {
      minimumWage: SMMLV,
      transportAllowance: 249_095,
      uvt: 52_374,
      employerContributionExemption: true,
    });
    const result = PayrollCalculator.calculate(employee(), fullMonth, [], exempt);
    expect(result.employer.exempted).toBe(true);
    expect(result.employer.health.isZero()).toBe(true);
    expect(result.employer.sena.isZero()).toBe(true);
    expect(result.employer.icbf.isZero()).toBe(true);
    expect(result.employer.pension.amount).toBe(210_109);
  });

  it('computes FSP and withholding (procedimiento 1) for a high salary', () => {
    const result = PayrollCalculator.calculate(
      employee({ baseSalary: Money.of(20_000_000) }),
      fullMonth,
      [],
      params2026,
    );

    expect(result.earnings.transportAllowance.isZero()).toBe(true);
    expect(result.deductions.health.amount).toBe(800_000);
    expect(result.deductions.solidarityFund.amount).toBe(200_000);
    expect(result.deductions.solidarityFundRate).toBe(1);
    // base = 18.200.000 − 25 % exempt capped at 790/12 UVT (3.447.955) = 14.752.045 → 150–360 UVT bracket
    const expected = Math.round((14_752_045 - 150 * 52_374) * 0.28 + 10 * 52_374);
    expect(result.deductions.withholding.amount).toBe(expected);
    expect(result.net.amount).toBe(20_000_000 - 1_800_000 - expected);
  });

  it('pays approved absences according to their treatment and prorates transport', () => {
    const result = PayrollCalculator.calculate(
      employee(),
      { ...fullMonth, absences: { paid: 0, incapacity: 10, unpaid: 0 } },
      [],
      params2026,
    );
    expect(result.workedDays).toBe(20);
    expect(result.earnings.basicSalary.amount).toBe(1_167_270);
    // 2/3 of a minimum wage is below the minimum: the incapacity is paid at the daily minimum wage
    expect(result.earnings.leavePay.amount).toBe(583_635);
    expect(result.earnings.transportAllowance.amount).toBe(166_063);
  });

  it('does not pay unpaid leave days and lowers the minimum IBC accordingly', () => {
    const result = PayrollCalculator.calculate(
      employee(),
      { ...fullMonth, absences: { paid: 0, incapacity: 0, unpaid: 10 } },
      [],
      params2026,
    );
    expect(result.earnings.leavePay.isZero()).toBe(true);
    expect(result.ibc.amount).toBe(1_167_270);
  });

  it('liquidates half a month in biweekly periods and prorates recurring deductions', () => {
    const result = PayrollCalculator.calculate(
      employee({
        recurringDeductions: {
          libranza: Money.of(100_000),
          sindicato: Money.of(20_000),
          embargo: Money.zero(),
          embargoIsAlimony: false,
        },
      }),
      { frequency: 'biweekly', contractDays: 15, absences: { paid: 0, incapacity: 0, unpaid: 0 } },
      [{ type: 'libranza', amount: Money.of(30_000) }],
      params2026,
    );
    expect(result.earnings.basicSalary.amount).toBeCloseTo(875_453, -1);
    expect(result.deductions.libranza.amount).toBe(80_000);
    expect(result.deductions.sindicato.amount).toBe(10_000);
  });

  it('adds salary novelties to the IBC and non-salary excess over 40 %', () => {
    const result = PayrollCalculator.calculate(
      employee({ baseSalary: Money.of(3_000_000) }),
      fullMonth,
      [
        { type: 'overtime', amount: Money.of(200_000) },
        { type: 'bonus_non_salary', amount: Money.of(3_200_000) },
      ],
      params2026,
    );
    // remuneration 6.400.000; 40 % = 2.560.000; excess 640.000 enters the IBC
    expect(result.ibc.amount).toBe(3_200_000 + 640_000);
    // 3.000.000 ≤ 2 SMMLV, so the transport allowance is still paid
    expect(result.earnings.gross.amount).toBe(6_400_000 + 249_095);
  });

  it('uses 70 % of an integral salary as IBC and pays no transport allowance', () => {
    const result = PayrollCalculator.calculate(
      employee({ baseSalary: Money.of(26_000_000), integralSalary: true }),
      fullMonth,
      [],
      params2026,
    );
    expect(result.ibc.amount).toBe(18_200_000);
    expect(result.earnings.transportAllowance.isZero()).toBe(true);
  });

  it('caps deductions so the net pay is never negative', () => {
    const result = PayrollCalculator.calculate(
      employee({
        recurringDeductions: {
          libranza: Money.of(5_000_000),
          sindicato: Money.zero(),
          embargo: Money.of(500_000),
          embargoIsAlimony: false,
        },
      }),
      fullMonth,
      [{ type: 'other_deduction', amount: Money.of(1_000_000) }],
      params2026,
    );
    expect(result.deductions.embargo.isZero()).toBe(true); // the minimum wage is unseizable
    expect(result.deductions.libranza.amount).toBe(929_964);
    expect(result.deductions.other.isZero()).toBe(true);
    expect(result.net.amount).toBe(929_964);
    expect(result.notes).toHaveLength(3);
  });

  it('uses the ARL rate of the risk class', () => {
    const result = PayrollCalculator.calculate(employee({ arlRiskClass: 3 }), fullMonth, [], params2026);
    expect(result.employer.arl.amount).toBe(Math.round((SMMLV * 2.436) / 100));
  });

  it('rejects contractors and inconsistent days', () => {
    expect(() => PayrollCalculator.calculate(employee({ isContractor: true }), fullMonth, [], params2026)).toThrow(
      expect.objectContaining({ code: 'CONTRACTOR_NOT_IN_PAYROLL' }),
    );
    expect(() =>
      PayrollCalculator.calculate(
        employee(),
        { ...fullMonth, absences: { paid: 31, incapacity: 0, unpaid: 0 } },
        [],
        params2026,
      ),
    ).toThrow(expect.objectContaining({ code: 'INVALID_PAYROLL_DAYS' }));
  });
});

describe('solidarityFundRate', () => {
  it.each([
    [3.99, 0],
    [4, 1],
    [15.9, 1],
    [16, 1.2],
    [17.5, 1.4],
    [18, 1.6],
    [19, 1.8],
    [20, 1.8],
    [20.01, 2],
  ])('IBC of %d SMMLV pays %d %%', (ratio, rate) => {
    expect(solidarityFundRate(ratio)).toBe(rate);
  });
});
