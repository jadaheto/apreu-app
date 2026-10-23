/** Institutional data printed on report cards (`settings` keys `school_*`, `logo`). */
export interface InstitutionProfile {
  name: string;
  nit: string | null;
  address: string | null;
  logo: string | null;
}

/**
 * Read access to the school configuration owned by the identity/settings
 * context. The academic year is always `settings.academic_year` (legacy pages
 * that used `$_SESSION['academic_year']` or `date('Y')` were a bug, B16).
 */
export interface AcademicSettingsPort {
  /** `settings.academic_year`, or the current calendar year when not configured. */
  currentAcademicYear(): Promise<number>;
  institutionProfile(): Promise<InstitutionProfile>;
}

export const ACADEMIC_SETTINGS = Symbol('AcademicSettingsPort');
