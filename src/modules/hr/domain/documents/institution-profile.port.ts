/** School data printed on payslips and certificates (`settings`: school_*, rector_name, logo). */
export interface InstitutionProfile {
  name: string;
  nit: string | null;
  nitVerificationDigit: string | null;
  city: string | null;
  address: string | null;
  rectorName: string | null;
  logo: string | null;
}

/** Read-only port to the institution settings owned by identity/configuration. */
export interface InstitutionProfilePort {
  get(): Promise<InstitutionProfile>;
}

export const INSTITUTION_PROFILE = Symbol('InstitutionProfilePort');
