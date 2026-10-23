import { StudentCode } from './student-code.js';

describe('StudentCode', () => {
  it.each([
    [2026, 1, 'AL20260001'],
    [2026, 42, 'AL20260042'],
    [2027, 12345, 'AL202712345'],
  ])('composes year %i and sequence %i as %s', (year, sequence, expected) => {
    expect(StudentCode.compose(year, sequence).toString()).toBe(expected);
  });

  it.each([
    [2026, 0],
    [1999, 1],
    [2026, 1.5],
  ])('rejects year %i with sequence %d', (year, sequence) => {
    expect(() => StudentCode.compose(year, sequence)).toThrow();
  });

  it('restores legacy codes as they are and compares by value', () => {
    expect(StudentCode.restore('X-1').toString()).toBe('X-1');
    expect(StudentCode.compose(2026, 1).equals(StudentCode.restore('AL20260001'))).toBe(true);
  });
});
