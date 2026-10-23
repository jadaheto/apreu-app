import { BillingPeriod } from './billing-period.vo.js';
import { Calendar } from './calendar.js';

describe('Calendar', () => {
  it('uses the Bogotá calendar day', () => {
    expect(Calendar.today(new Date('2026-03-01T03:00:00Z'))).toBe('2026-02-28');
    expect(Calendar.today(new Date('2026-03-01T06:00:00Z'))).toBe('2026-03-01');
  });

  it('validates real days', () => {
    expect(Calendar.assertDate('2024-02-29', 'f')).toBe('2024-02-29');
    expect(() => Calendar.assertDate('2026-02-31', 'f')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
    expect(() => Calendar.assertDate('31/01/2026', 'f')).toThrow();
  });

  it('computes day differences and offsets', () => {
    expect(Calendar.daysBetween('2026-01-31', '2026-03-02')).toBe(30);
    expect(Calendar.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(Calendar.startOfDay('2026-03-15').toISOString()).toBe('2026-03-15T05:00:00.000Z');
    expect(Calendar.compact('2026-03-15')).toBe('20260315');
  });
});

describe('BillingPeriod', () => {
  it('knows its days and neighbours', () => {
    const february = BillingPeriod.create('2024-02');
    expect(february.firstDay()).toBe('2024-02-01');
    expect(february.lastDay()).toBe('2024-02-29');
    expect(BillingPeriod.create('2026-12').next().toString()).toBe('2027-01');
    expect(BillingPeriod.create('2026-01').previous().toString()).toBe('2025-12');
  });

  it('labels the month in Spanish (bug B16)', () => {
    expect(BillingPeriod.create('2026-03').label()).toBe('Marzo 2026');
  });

  it('rejects invalid months', () => {
    expect(() => BillingPeriod.create('2026-13')).toThrow(expect.objectContaining({ code: 'INVALID_PERIOD' }));
    expect(BillingPeriod.fromDate('2026-05-20').equals(BillingPeriod.create('2026-05'))).toBe(true);
  });
});
