import { AccountingPeriod } from './accounting-period.js';
import { CalendarDay } from './calendar-day.js';

describe('AccountingPeriod', () => {
  const create = () => AccountingPeriod.create({ name: 'Marzo 2026', startDate: '2026-03-01', endDate: '2026-03-31' });
  const at = new Date('2026-04-01T12:00:00Z');

  it('is born open and knows its range', () => {
    const period = create();
    expect(period.isOpen).toBe(true);
    expect(period.contains('2026-03-31')).toBe(true);
    expect(period.contains('2026-04-01')).toBe(false);
    expect(period.overlaps('2026-02-15', '2026-03-01')).toBe(true);
    expect(period.overlaps('2026-04-01', '2026-04-30')).toBe(false);
  });

  it('rejects inverted or invalid dates', () => {
    expect(() => AccountingPeriod.create({ name: 'X', startDate: '2026-03-31', endDate: '2026-03-01' })).toThrow(
      expect.objectContaining({ code: 'INVERTED_DATES' }),
    );
    expect(() => AccountingPeriod.create({ name: 'X', startDate: '2026-02-30', endDate: '2026-03-01' })).toThrow(
      expect.objectContaining({ code: 'INVALID_DATE' }),
    );
  });

  it('closes and reopens with audit data', () => {
    const period = create();
    period.close(3, at);
    expect(period).toMatchObject({ status: 'closed', closedBy: 3, closedAt: at });
    expect(() => period.close(3, at)).toThrow(expect.objectContaining({ code: 'PERIOD_ALREADY_CLOSED' }));
    expect(() => period.assertOpen()).toThrow(expect.objectContaining({ code: 'PERIOD_CLOSED' }));
    expect(() => period.reopen(1, at, ' ')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    period.reopen(1, at, 'Ajuste');
    expect(period).toMatchObject({ status: 'open', reopenedBy: 1, reopenReason: 'Ajuste' });
    expect(() => period.reopen(1, at, 'otra')).toThrow(expect.objectContaining({ code: 'PERIOD_ALREADY_OPEN' }));
  });
});

describe('CalendarDay', () => {
  it('handles Colombian days, month ranges and arithmetic', () => {
    expect(CalendarDay.inColombia(new Date('2026-03-01T03:00:00Z'))).toBe('2026-02-28');
    expect(CalendarDay.monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(CalendarDay.addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(() => CalendarDay.monthRange('2026-13')).toThrow(expect.objectContaining({ code: 'INVALID_MONTH' }));
  });
});
