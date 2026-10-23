import { TuitionSchedule } from './tuition-schedule.js';

describe('TuitionSchedule', () => {
  it('resolves the specific rate, then the general one', () => {
    const schedule = TuitionSchedule.create(2026, [
      { gradeId: 1, conceptId: 3, amount: 410000 },
      { gradeId: 1, conceptId: null, amount: 390000 },
    ]);
    expect(schedule.rateFor(1, 3)?.amount).toBe(410000);
    expect(schedule.rateFor(1, 9)?.amount).toBe(390000);
    expect(schedule.rateFor(2, 3)).toBeNull();
    expect(schedule.gradeIds()).toEqual([1]);
    expect(schedule.conceptIds()).toEqual([3]);
  });

  it.each([
    [
      [
        { gradeId: 1, conceptId: null, amount: 1 },
        { gradeId: 1, conceptId: null, amount: 2 },
      ],
      'DUPLICATED_TUITION_RATE',
    ],
    [[{ gradeId: 1, conceptId: null, amount: 0 }], 'INVALID_TUITION_AMOUNT'],
    [[{ gradeId: 0, conceptId: null, amount: 5 }], 'TUITION_GRADE_REQUIRED'],
  ])('rejects invalid rates', (rates, code) => {
    expect(() => TuitionSchedule.create(2026, rates)).toThrow(expect.objectContaining({ code }));
  });

  it('validates the academic year', () => {
    expect(() => TuitionSchedule.create(1999, [])).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
  });
});
