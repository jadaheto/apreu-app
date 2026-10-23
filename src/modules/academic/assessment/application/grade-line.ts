import type { Performance } from '../domain/performance-scale.js';

/** One subject row of a student's grades (portal, report card). */
export interface GradeLine {
  subjectId: number;
  subjectName: string;
  area: string;
  teacherName: string | null;
  cognitive: number;
  procedural: number;
  attitudinal: number;
  finalScore: number;
  passing: boolean;
  performance: Performance;
  observations: string | null;
}

/** Shown when a subject has no area (legacy "General"). */
export const DEFAULT_AREA = 'General';
