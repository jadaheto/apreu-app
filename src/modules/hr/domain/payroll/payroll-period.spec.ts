import { ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { PayrollPeriod, type NewPayrollPeriod } from './payroll-period.js';

const input = (overrides: Partial<NewPayrollPeriod> = {}): NewPayrollPeriod => ({
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  paymentDate: '2026-03-30',
  frequency: 'monthly',
  createdBy: 1,
  ...overrides,
});
const at = new Date('2026-03-28T10:00:00-05:00');
const totals = { gross: Money.of(100), deductions: Money.of(10), net: Money.of(90) };

describe('PayrollPeriod', () => {
  it('creates a draft with a default name and label', () => {
    const period = PayrollPeriod.create(input());
    expect(period).toMatchObject({ status: 'draft', name: 'Nómina marzo 2026', periodLabel: 'marzo 2026', year: 2026 });
  });

  it.each([
    [{ startDate: '2026-03-01', endDate: '2026-03-15', frequency: 'biweekly' }, '1ª quincena de marzo 2026'],
    [
      { startDate: '2026-02-16', endDate: '2026-02-28', frequency: 'biweekly', paymentDate: '2026-02-28' },
      '2ª quincena de febrero 2026',
    ],
  ])('accepts fortnights %o', (override, label) => {
    expect(PayrollPeriod.create(input(override as Partial<NewPayrollPeriod>)).periodLabel).toBe(label);
  });

  it.each([
    [{ endDate: '2026-03-30' }, 'INVALID_PERIOD_RANGE'],
    [{ startDate: '2026-03-01', endDate: '2026-03-01' }, 'INVALID_PERIOD_RANGE'],
    [{ startDate: '2026-03-02', endDate: '2026-03-16', frequency: 'biweekly' }, 'INVALID_PERIOD_RANGE'],
    [{ paymentDate: '2026-02-27' }, 'INVALID_PAYMENT_DATE'],
    [{ frequency: 'weekly' }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() => PayrollPeriod.create(input(override as Partial<NewPayrollPeriod>))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('walks the happy path draft → calculated → approved → paid', () => {
    const period = PayrollPeriod.create(input());
    period.recordCalculation(totals, 5, at);
    expect(period).toMatchObject({ status: 'calculated', calculatedBy: 5 });
    period.approve(6, at, true);
    expect(period).toMatchObject({ status: 'approved', approvedBy: 6, isReleased: true });
    expect(() => period.ensureEditable()).toThrow(expect.objectContaining({ code: 'PAYROLL_PERIOD_LOCKED' }));
    period.markPaid(at);
    expect(period).toMatchObject({ status: 'paid', paidAt: at });
    expect(() => period.markPaid(at)).toThrow(expect.objectContaining({ code: 'INVALID_PAYROLL_PERIOD_STATUS' }));
  });

  it('enforces segregation of duties when requested', () => {
    const period = PayrollPeriod.create(input());
    period.recordCalculation(totals, 5, at);
    expect(() => period.approve(5, at, true)).toThrow(ForbiddenError);
    period.approve(5, at, false);
    expect(period.status).toBe('approved');
  });

  it('cannot be approved before calculation and goes back to draft when novelties change', () => {
    const period = PayrollPeriod.create(input());
    expect(() => period.approve(6, at, false)).toThrow(
      expect.objectContaining({ code: 'INVALID_PAYROLL_PERIOD_STATUS' }),
    );
    period.recordCalculation(totals, 5, at);
    period.invalidateCalculation();
    expect(period.status).toBe('draft');
  });

  it('is cancelled only while editable and with a reason', () => {
    const period = PayrollPeriod.create(input());
    expect(() => period.cancel('', at)).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    period.cancel('Fechas erradas', at);
    expect(period).toMatchObject({ status: 'cancelled', cancellationReason: 'Fechas erradas' });
    expect(() => period.recordCalculation(totals, 1, at)).toThrow(
      expect.objectContaining({ code: 'PAYROLL_PERIOD_LOCKED' }),
    );
  });

  it('detects overlaps', () => {
    const period = PayrollPeriod.create(input());
    expect(period.overlaps('2026-03-16', '2026-03-31')).toBe(true);
    expect(period.overlaps('2026-04-01', '2026-04-15')).toBe(false);
  });
});
