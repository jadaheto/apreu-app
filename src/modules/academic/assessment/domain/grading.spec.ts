import { ComponentScores, GradingWeights } from './component-scores.js';
import { classifyAverage, classifyPerformance } from './performance-scale.js';
import { ReportCard } from './report-card.js';
import { averageOf, isPassingAverage, Score } from './score.js';
import { StudentGrade } from './student-grade.js';

describe('Score', () => {
  it('keeps one decimal, rounding half-up', () => {
    expect(Score.of(4.55).toNumber()).toBe(4.6);
    expect(Score.of(2.45).toNumber()).toBe(2.5);
    expect(Score.of(3).isPassing()).toBe(true);
    expect(Score.of(2.9).isPassing()).toBe(false);
  });

  it.each([-0.1, 5.1, Number.NaN])('rejects %s', (value) => {
    expect(() => Score.of(value)).toThrow(expect.objectContaining({ code: 'INVALID_SCORE' }));
  });

  it('averages final scores with two decimals', () => {
    expect(averageOf([Score.of(3), Score.of(3.5), Score.of(4.2)])).toBe(3.57);
    expect(averageOf([])).toBeNull();
    expect(isPassingAverage(2.99)).toBe(false);
  });
});

describe('ComponentScores', () => {
  it.each([
    [{ cognitive: 4, procedural: 3, attitudinal: 5 }, 3.8],
    [{ cognitive: 5, procedural: 5, attitudinal: 5 }, 5],
    [{ cognitive: 3.5, procedural: 2.5, attitudinal: 4.5 }, 3.3],
    [{ cognitive: 2.9, procedural: 3.1, attitudinal: 2.2 }, 2.9],
    [{ cognitive: 4.5 }, 2.7],
  ])('weights %o as 60/30/10 → %s', (input, expected) => {
    expect(ComponentScores.of(input).finalScore().toNumber()).toBe(expected);
  });

  it('rounds the weighted final half-up (3.25 → 3.3)', () => {
    // 0.6·3.0 + 0.3·3.5 + 0.1·4.0 = 3.25
    expect(ComponentScores.of({ cognitive: 3, procedural: 3.5, attitudinal: 4 }).finalScore().toNumber()).toBe(3.3);
  });

  it('only accepts weights summing 100', () => {
    expect(GradingWeights.STANDARD).toMatchObject({ cognitive: 60, procedural: 30, attitudinal: 10 });
    expect(() => GradingWeights.of(50, 30, 10)).toThrow(expect.objectContaining({ code: 'INVALID_GRADING_WEIGHTS' }));
  });
});

describe('performance scale (Decreto 1290)', () => {
  it.each([
    [5, 'superior'],
    [4.6, 'superior'],
    [4.5, 'alto'],
    [4, 'alto'],
    [3.9, 'basico'],
    [3, 'basico'],
    [2.9, 'bajo'],
    [0, 'bajo'],
  ])('%s → %s', (value, level) => {
    expect(classifyPerformance(Score.of(value)).level).toBe(level);
  });

  it('classifies averages rounded to one decimal', () => {
    expect(classifyAverage(4.55)).toEqual({ level: 'superior', label: 'Superior' });
  });
});

describe('StudentGrade', () => {
  const base = { studentId: 1, subjectId: 2, periodId: 3, academicYear: 2026, periodNumber: 1 };

  it('derives the final score and trims observations', () => {
    const grade = StudentGrade.record({
      ...base,
      scores: ComponentScores.of({ cognitive: 4 }),
      observations: '  bien ',
    });
    expect(grade.finalScore.toNumber()).toBe(2.4);
    expect(grade.observations).toBe('bien');
    grade.regrade(ComponentScores.of({ cognitive: 5, procedural: 5, attitudinal: 5 }), '', 2);
    expect(grade).toMatchObject({ observations: null, periodNumber: 2 });
    expect(grade.finalScore.toNumber()).toBe(5);
  });

  it('limits observations to 500 characters', () => {
    expect(() =>
      StudentGrade.record({ ...base, scores: ComponentScores.of({}), observations: 'x'.repeat(501) }),
    ).toThrow(expect.objectContaining({ code: 'MAX_LENGTH' }));
  });
});

describe('ReportCard', () => {
  it('is generated, regenerated and counts views', () => {
    const at = new Date('2026-04-20T10:00:00Z');
    const card = ReportCard.generate({ studentId: 1, periodId: 2, averageScore: 3.57, at });
    expect(card).toMatchObject({ documentPath: 'academic/report-cards/1/2/pdf', viewCount: 0, lastViewedAt: null });
    card.regenerate(4.1, at);
    card.registerView(at);
    expect(card).toMatchObject({ averageScore: 4.1, viewCount: 1, lastViewedAt: at });
    expect(() => card.regenerate(6, at)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
  });
});
