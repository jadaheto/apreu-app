/**
 * Tells which billing concepts are certificates (`billing_concepts.category =
 * 'certificado'` or a name containing "certificado", legacy
 * `finance/cashier.php:96-115`). Owned by the finance context.
 */
export interface CertificateConceptCatalogPort {
  /** Subset of `conceptIds` that correspond to certificate concepts. */
  certificateConceptIds(conceptIds: number[]): Promise<number[]>;
}

export const CERTIFICATE_CONCEPT_CATALOG = Symbol('CertificateConceptCatalogPort');

/** Name-based rule of the legacy cashier (case and accent insensitive). */
export const isCertificateConceptName = (name: string): boolean =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('certificado');
