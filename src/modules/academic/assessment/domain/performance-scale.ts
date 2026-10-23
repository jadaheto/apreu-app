import { Score } from './score.js';

export type PerformanceLevel = 'superior' | 'alto' | 'basico' | 'bajo';

export interface Performance {
  level: PerformanceLevel;
  label: string;
}

interface PerformanceBand extends Performance {
  /** Lower bound in tenths (inclusive). */
  fromTenths: number;
}

/**
 * National performance scale (Decreto 1290 de 2009), the one recommended by the
 * functional analysis (rule 22) to replace the two legacy scales:
 * Superior 4.6–5.0 · Alto 4.0–4.5 · Básico 3.0–3.9 · Bajo 0.0–2.9.
 */
const NATIONAL_SCALE: readonly PerformanceBand[] = [
  { fromTenths: 46, level: 'superior', label: 'Superior' },
  { fromTenths: 40, level: 'alto', label: 'Alto' },
  { fromTenths: 30, level: 'basico', label: 'Básico' },
  { fromTenths: 0, level: 'bajo', label: 'Bajo' },
];

/** Classifies a score in the national performance scale. */
export const classifyPerformance = (score: Score): Performance => {
  const band = NATIONAL_SCALE.find((b) => score.tenths >= b.fromTenths) ?? NATIONAL_SCALE[NATIONAL_SCALE.length - 1];
  return { level: band.level, label: band.label };
};

/** Classifies a two-decimal average (rounded to one decimal first). */
export const classifyAverage = (average: number): Performance => classifyPerformance(Score.of(average));
