/**
 * Institutional data printed on ID cards and certificates (`settings` keys
 * `school_name`, `school_nit`, `school_city`, `rector_name`, `academic_year`,
 * `logo`, `logo_size`, `signature`). Owned by the identity/configuration context.
 */
export interface InstitutionProfile {
  schoolName: string;
  nit: string;
  city: string;
  rectorName: string;
  /** `settings.academic_year`; `null` when not configured. */
  academicYear: number | null;
  logo: string | null;
  /** Logo height in px for the ID card header (legacy default 40). */
  logoSize: number;
  signature: string | null;
}

/** Read-only port over the school settings. */
export interface InstitutionSettingsPort {
  load(): Promise<InstitutionProfile>;
}

export const INSTITUTION_SETTINGS = Symbol('InstitutionSettingsPort');
