import { assertAcademicYear } from './academic-year.js';
import { groupBy, indexBy, unique } from './collections.js';
import { assertIntegerInRange } from './integer-range.js';
import { requireFound } from './require-found.js';
import {
  assertIsoDate,
  isIsoDate,
  monthInterval,
  schoolDateOf,
  schoolMonthOf,
  schoolTimeOf,
} from './school-calendar.js';
import { canTeach, staffDisplayName } from './staff-directory.port.js';
import { studentDisplayName } from './student-directory.port.js';

describe('school calendar', () => {
  it('validates real ISO days', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-2-1')).toBe(false);
    expect(() => assertIsoDate('2026-13-01', 'fecha')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });

  it('uses Colombian time (UTC-05:00) for dates and times', () => {
    const lateNight = new Date('2026-03-16T03:30:00Z');
    expect(schoolDateOf(lateNight)).toBe('2026-03-15');
    expect(schoolTimeOf(lateNight)).toBe('22:30:00');
    expect(schoolMonthOf(new Date('2026-04-01T02:00:00Z'))).toBe('2026-03');
  });

  it('computes month intervals including leap years', () => {
    expect(monthInterval('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(() => monthInterval('2026-13')).toThrow(expect.objectContaining({ code: 'INVALID_MONTH' }));
  });
});

describe('guards and helpers', () => {
  it('validates academic years and integer ranges', () => {
    expect(assertAcademicYear(2026)).toBe(2026);
    expect(() => assertAcademicYear(2026.5)).toThrow(expect.objectContaining({ code: 'INVALID_ACADEMIC_YEAR' }));
    expect(() => assertAcademicYear(1999)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => assertIntegerInRange(Number.NaN, 1, 5, 'x')).toThrow(
      expect.objectContaining({ code: 'OUT_OF_RANGE' }),
    );
    expect(assertIntegerInRange(3, 1, 5, 'x')).toBe(3);
  });

  it('requires found values', () => {
    expect(requireFound(0, 'X', 1)).toBe(0);
    expect(() => requireFound(null, 'Salón', 9)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('indexes, groups and deduplicates', () => {
    expect(unique([1, 2, 1])).toEqual([1, 2]);
    expect(indexBy([{ id: 1, v: 'a' }], (x) => x.id).get(1)?.v).toBe('a');
    expect(groupBy([1, 2, 3], (n) => n % 2).get(1)).toEqual([1, 3]);
  });

  it('formats names and decides teaching eligibility', () => {
    expect(studentDisplayName({ firstName: 'Ana', lastName: 'Pérez' })).toBe('Pérez Ana');
    expect(staffDisplayName({ firstName: 'Laura', lastName: 'Gómez' })).toBe('Laura Gómez');
    const member = { id: 1, code: 'D1', firstName: 'A', lastName: 'B', employeeType: 'docente', status: 'active' };
    expect(canTeach(member)).toBe(true);
    expect(canTeach({ ...member, employeeType: 'servicios' })).toBe(false);
    expect(canTeach({ ...member, status: 'retired' })).toBe(false);
  });
});
