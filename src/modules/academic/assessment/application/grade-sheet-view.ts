import type { PeriodStatus } from '../../calendar/domain/academic-period.js';
import type { Performance } from '../domain/performance-scale.js';

export interface GradeSheetRow {
  studentId: number;
  code: string;
  /** "APELLIDO NOMBRE". */
  fullName: string;
  cognitive: number | null;
  procedural: number | null;
  attitudinal: number | null;
  finalScore: number | null;
  passing: boolean | null;
  performance: Performance | null;
  observations: string | null;
}

/** Grade sheet of a classroom/subject/period (legacy `academic/grades_entry.php`). */
export interface GradeSheetView {
  classroom: { id: number; name: string; academicYear: number };
  subject: { id: number; name: string };
  period: { id: number; name: string; status: PeriodStatus };
  /** Only the open period can be saved (rule 18). */
  editable: boolean;
  weights: { cognitive: number; procedural: number; attitudinal: number };
  rows: GradeSheetRow[];
}
