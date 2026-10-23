import { amountInWords } from '../documents/amount-in-words.js';
import { IssuedDocument } from '../documents/issued-document.js';
import { EmployeeSticker } from '../stickers/employee-sticker.js';
import { CalendarDate } from './calendar-date.js';

describe('CalendarDate', () => {
  it.each(['2026-02-29', '2026-13-01', '26-01-01', ''])('rejects "%s"', (value) => {
    expect(() => CalendarDate.assert(value, 'fecha')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });

  it('accepts optional empty dates', () => {
    expect(CalendarDate.assertOptional('  ', 'fecha')).toBeNull();
    expect(CalendarDate.assertOptional('2024-02-29', 'fecha')).toBe('2024-02-29');
  });

  it.each([
    ['2026-03-01', '2026-03-31', 30],
    ['2026-02-01', '2026-02-28', 30],
    ['2026-02-16', '2026-02-28', 15],
    ['2026-03-16', '2026-03-31', 15],
    ['2026-03-10', '2026-03-20', 11],
    ['2026-03-31', '2026-03-31', 0],
    ['2026-01-31', '2026-02-01', 1],
    ['2026-03-20', '2026-03-10', 0],
  ])('commercial days %s..%s = %d', (start, end, days) => {
    expect(CalendarDate.commercialDaysInclusive(start, end)).toBe(days);
  });

  it('counts calendar days and months', () => {
    expect(CalendarDate.calendarDaysInclusive('2026-02-27', '2026-03-02')).toBe(4);
    expect(CalendarDate.fullMonthsBetween('2024-02-15', '2026-03-14')).toBe(24);
    expect(CalendarDate.fullMonthsBetween('2024-02-15', '2026-03-15')).toBe(25);
  });

  it('converts instants to the Bogotá calendar day', () => {
    expect(CalendarDate.fromInstant(new Date('2026-03-16T03:00:00Z'))).toBe('2026-03-15');
  });
});

describe('amountInWords', () => {
  it.each([
    [1, 'un peso m/cte.'],
    [21, 'veintiún pesos m/cte.'],
    [100, 'cien pesos m/cte.'],
    [101_000, 'ciento un mil pesos m/cte.'],
    [1_000_000, 'un millón de pesos m/cte.'],
    [1_750_905, 'un millón setecientos cincuenta mil novecientos cinco pesos m/cte.'],
    [2_531_031, 'dos millones quinientos treinta y un mil treinta y un pesos m/cte.'],
    [21_000_000, 'veintiún millones de pesos m/cte.'],
  ])('%d → %s', (amount, words) => {
    expect(amountInWords(amount)).toBe(words);
  });
});

describe('EmployeeSticker', () => {
  it('defaults color and priority and marks read once', () => {
    const sticker = EmployeeSticker.create({ employeeId: 1, title: ' Entregar notas ', createdBy: 2 });
    expect(sticker).toMatchObject({ title: 'Entregar notas', color: 'yellow', priority: 'normal', isRead: false });
    const first = new Date('2026-03-01');
    sticker.markRead(first);
    sticker.markRead(new Date('2026-03-02'));
    expect(sticker.readAt).toEqual(first);
  });

  it.each([
    [{ title: '' }, 'REQUIRED_FIELD'],
    [{ color: 'black' }, 'INVALID_OPTION'],
    [{ priority: 'high' }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() => EmployeeSticker.create({ employeeId: 1, title: 'x', createdBy: 2, ...(override as object) })).toThrow(
      expect.objectContaining({ code }),
    );
  });
});

describe('IssuedDocument', () => {
  it('freezes a copy of the content', () => {
    const content = { name: 'Ana' };
    const document = IssuedDocument.issue({
      code: 'ABC',
      type: 'employment_certificate',
      employeeId: 1,
      content,
      issuedBy: 2,
      issuedAt: new Date(),
    });
    content.name = 'Otra';
    expect(document.content).toEqual({ name: 'Ana' });
  });
});
