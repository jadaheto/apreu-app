import type { InstitutionProfile } from '../../common/domain/academic-settings.port.js';
import type { Performance } from '../domain/performance-scale.js';
import type { GradeLine } from './grade-line.js';

/**
 * Everything printed on a report card (legacy `academic/bulletin_view.php`),
 * plus performance levels and absences, which the legacy did not show.
 */
export interface ReportCardDocument {
  institution: InstitutionProfile;
  student: { id: number; code: string; fullName: string; documentNumber: string | null };
  classroom: { name: string; gradeName: string } | null;
  groupDirectorName: string | null;
  period: { id: number; name: string; academicYear: number; startDate: string; endDate: string };
  lines: GradeLine[];
  averageScore: number;
  averagePerformance: Performance;
  passing: boolean;
  absences: number;
  generatedAt: Date;
  viewCount: number;
}
