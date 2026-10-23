import { Calendar } from './calendar.js';

describe('Calendar', () => {
  it('uses the Colombian day, not the UTC one', () => {
    expect(Calendar.localDay(new Date('2026-10-17T03:30:00Z'))).toBe('2026-10-16');
    expect(Calendar.localDay(new Date('2026-10-17T05:30:00Z'))).toBe('2026-10-17');
  });

  it('adds days and finds month starts across years', () => {
    expect(Calendar.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(Calendar.monthStart('2026-03-15')).toBe('2026-03-01');
    expect(Calendar.monthStart('2026-03-15', -5)).toBe('2025-10-01');
    expect(Calendar.monthStart('2026-12-15', 1)).toBe('2027-01-01');
  });

  it('counts days between dates', () => {
    expect(Calendar.daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(Calendar.daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('lists exactly the last N months with Spanish labels (legacy B16, B22)', () => {
    expect(Calendar.lastMonths('2026-03-15', 6)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(Calendar.monthLabel('2026-01')).toBe('ene');
    expect(Calendar.monthLabel('2025-12')).toBe('dic');
  });
});
