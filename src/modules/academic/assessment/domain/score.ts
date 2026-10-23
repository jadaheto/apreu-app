import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../../shared/domain/value-object.js';

export const MIN_SCORE = 0;
export const MAX_SCORE = 5;
/** Passing mark: final ≥ 3.0 (red below it in every legacy view). */
export const PASSING_SCORE = 3;

/**
 * A grade on the 0.0–5.0 scale with one decimal (`DECIMAL(3,1)` columns),
 * stored as integer tenths to avoid floating point drift. Values with more
 * decimals are rounded half-up.
 */
export class Score extends ValueObject<number> {
  private constructor(tenths: number) {
    super(tenths);
  }

  static of(value: number): Score {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_SCORE || value > MAX_SCORE) {
      throw new BusinessRuleViolationError(
        `La nota debe ser un número entre ${MIN_SCORE.toFixed(1)} y ${MAX_SCORE.toFixed(1)}.`,
        'INVALID_SCORE',
        { value },
      );
    }
    return new Score(Math.round(Number((value * 10).toPrecision(12))));
  }

  static fromTenths(tenths: number): Score {
    return Score.of(tenths / 10);
  }

  get tenths(): number {
    return this.value;
  }

  toNumber(): number {
    return this.value / 10;
  }

  isPassing(): boolean {
    return this.value >= PASSING_SCORE * 10;
  }
}

/**
 * Simple arithmetic mean of final scores with two decimals (legacy rule 23: not
 * weighted by weekly hours). `null` when there are no scores.
 */
export const averageOf = (scores: readonly Score[]): number | null => {
  if (scores.length === 0) return null;
  const totalTenths = scores.reduce((sum, score) => sum + score.tenths, 0);
  return Math.round((totalTenths * 10) / scores.length) / 100;
};

/** True when an average (two decimals) reaches the passing mark. */
export const isPassingAverage = (average: number): boolean => average >= PASSING_SCORE;
