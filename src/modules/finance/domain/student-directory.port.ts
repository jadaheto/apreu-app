/**
 * Student data needed for billing, owned by the students/academic contexts and
 * read here through an anti-corruption port (`students`, `classrooms`,
 * `grades`, `guardians`).
 */
export interface BillingStudent {
  id: number;
  code: string;
  fullName: string;
  documentNumber: string | null;
  status: string;
  gradeId: number | null;
  gradeName: string | null;
  classroomName: string | null;
  scholarshipPct: number;
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface StudentDirectoryPort {
  findById(id: number): Promise<BillingStudent | null>;
  /** Active students, optionally of one grade, ordered by last name. */
  findActive(filter: { gradeId?: number }): Promise<BillingStudent[]>;
  /** Active students matching name, code or document; at most `limit`. */
  search(term: string, limit: number): Promise<BillingStudent[]>;
}

export const STUDENT_DIRECTORY = Symbol('StudentDirectoryPort');
