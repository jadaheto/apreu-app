/** Public metadata of the signing certificate (the key material never leaves the adapter). */
export interface CertificateInfo {
  subject: string;
  issuer: string;
  /** Decimal serial number. */
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
}

/**
 * Access to the school's digital signature certificate. The certificate is
 * read from a secret location configured outside the repository and the
 * database (see the adapter); `describe` returns `null` when none is configured.
 */
export interface CertificateStorePort {
  describe(): Promise<CertificateInfo | null>;
}

export const CERTIFICATE_STORE = Symbol('CertificateStorePort');
