import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { ValueObject } from '../../../../shared/domain/value-object.js';
import { Score } from './score.js';

/**
 * Weights (integer percentages) of the three evaluation components.
 * Standard institutional weights: cognitive 60 %, procedural 30 %,
 * attitudinal 10 % (legacy `academic/grades_entry.php:100`).
 */
export class GradingWeights extends ValueObject<{ cognitive: number; procedural: number; attitudinal: number }> {
  static readonly STANDARD = GradingWeights.of(60, 30, 10);

  private constructor(value: { cognitive: number; procedural: number; attitudinal: number }) {
    super(value);
  }

  static of(cognitive: number, procedural: number, attitudinal: number): GradingWeights {
    const weights = [cognitive, procedural, attitudinal];
    if (weights.some((w) => !Number.isInteger(w) || w < 0) || cognitive + procedural + attitudinal !== 100) {
      throw new BusinessRuleViolationError(
        'Los pesos de evaluación deben ser porcentajes enteros que sumen 100.',
        'INVALID_GRADING_WEIGHTS',
      );
    }
    return new GradingWeights({ cognitive, procedural, attitudinal });
  }

  get cognitive(): number {
    return this.value.cognitive;
  }
  get procedural(): number {
    return this.value.procedural;
  }
  get attitudinal(): number {
    return this.value.attitudinal;
  }
}

/**
 * Cognitive, procedural and attitudinal scores of a grade. Missing components
 * count as 0.0 (legacy behaviour).
 */
export class ComponentScores extends ValueObject<{ cognitive: Score; procedural: Score; attitudinal: Score }> {
  private constructor(value: { cognitive: Score; procedural: Score; attitudinal: Score }) {
    super(value);
  }

  static of(input: {
    cognitive?: number | null;
    procedural?: number | null;
    attitudinal?: number | null;
  }): ComponentScores {
    return new ComponentScores({
      cognitive: Score.of(input.cognitive ?? 0),
      procedural: Score.of(input.procedural ?? 0),
      attitudinal: Score.of(input.attitudinal ?? 0),
    });
  }

  get cognitive(): Score {
    return this.value.cognitive;
  }
  get procedural(): Score {
    return this.value.procedural;
  }
  get attitudinal(): Score {
    return this.value.attitudinal;
  }

  /**
   * `final = 0.6·cog + 0.3·pro + 0.1·att`, rounded half-up to one decimal,
   * computed with integers (tenths × percent) so 0.1 steps never drift.
   */
  finalScore(weights: GradingWeights = GradingWeights.STANDARD): Score {
    const weighted =
      this.cognitive.tenths * weights.cognitive +
      this.procedural.tenths * weights.procedural +
      this.attitudinal.tenths * weights.attitudinal;
    return Score.fromTenths(Math.floor((weighted + 50) / 100));
  }
}
