import { AcademicPeriod } from './academic-period.js';
import { PeriodCalendar } from './period-calendar.js';

const period = (overrides: Partial<{ name: string; startDate: string; endDate: string; open: boolean }> = {}) =>
  AcademicPeriod.create({
    name: 'Primer Período',
    academicYear: 2026,
    startDate: '2026-02-01',
    endDate: '2026-04-15',
    open: true,
    ...overrides,
  });

describe('AcademicPeriod', () => {
  it('follows open → closed → bulletins_generated and allows reopening a closed period', () => {
    const p = period();
    const at = new Date('2026-04-16T12:00:00Z');
    p.close(at);
    expect(p).toMatchObject({ status: 'closed', closedAt: at, isOpen: false });
    p.reopen();
    expect(p).toMatchObject({ status: 'open', closedAt: null });
    p.close(at);
    p.markBulletinsGenerated();
    p.markBulletinsGenerated();
    expect(p.hasBulletins).toBe(true);
  });

  it.each([
    ['close twice', (p: AcademicPeriod) => (p.close(new Date()), p.close(new Date()))],
    ['reopen an open period', (p: AcademicPeriod) => p.reopen()],
    ['generate bulletins of an open period (B18)', (p: AcademicPeriod) => p.markBulletinsGenerated()],
  ])('rejects: %s', (_case, action) => {
    expect(() => action(period())).toThrow(expect.objectContaining({ code: 'INVALID_PERIOD_TRANSITION' }));
  });

  it('cannot reopen nor reschedule once bulletins were generated', () => {
    const p = period();
    p.close(new Date());
    p.markBulletinsGenerated();
    expect(() => p.reopen()).toThrow(expect.objectContaining({ code: 'INVALID_PERIOD_TRANSITION' }));
    expect(() => p.reschedule({ name: 'X', startDate: '2026-02-01', endDate: '2026-03-01' })).toThrow(
      expect.objectContaining({ code: 'PERIOD_LOCKED' }),
    );
  });

  it.each([
    [{ endDate: '2026-01-01' }, 'INVERTED_DATES'],
    [{ startDate: '2025-12-01' }, 'PERIOD_OUTSIDE_YEAR'],
    [{ startDate: '2026-02-30' }, 'INVALID_DATE'],
    [{ name: 'x'.repeat(51) }, 'MAX_LENGTH'],
  ])('validates %o', (override, code) => {
    expect(() => period(override)).toThrow(expect.objectContaining({ code }));
  });

  it('starts closed when requested', () => {
    expect(period({ open: false }).status).toBe('closed');
  });
});

describe('PeriodCalendar', () => {
  const first = AcademicPeriod.restore(1, {
    name: 'P1',
    academicYear: 2026,
    startDate: '2026-02-01',
    endDate: '2026-04-15',
    status: 'open',
    closedAt: null,
  });
  const second = AcademicPeriod.restore(2, {
    name: 'P2',
    academicYear: 2026,
    startDate: '2026-04-16',
    endDate: '2026-06-30',
    status: 'closed',
    closedAt: null,
  });

  it('detects overlaps but ignores the period itself', () => {
    expect(() => PeriodCalendar.assertNoOverlap(first, [first, second])).not.toThrow();
    expect(() =>
      PeriodCalendar.assertNoOverlap(period({ startDate: '2026-04-15', endDate: '2026-05-01' }), [first]),
    ).toThrow(expect.objectContaining({ code: 'PERIOD_OVERLAP' }));
  });

  it('closes the other open periods', () => {
    const open = AcademicPeriod.restore(3, {
      name: 'P0',
      academicYear: 2026,
      startDate: '2026-01-10',
      endDate: '2026-01-31',
      status: 'open',
      closedAt: null,
    });
    const closed = PeriodCalendar.closeOthers(second, [open, second], new Date());
    expect(closed).toEqual([open]);
    expect(open.status).toBe('closed');
  });

  it('numbers periods by start date', () => {
    expect(PeriodCalendar.ordinalOf(second, [second, first])).toBe(2);
    expect(PeriodCalendar.ordinalOf(first, [second, first])).toBe(1);
  });
});
