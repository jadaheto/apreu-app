import type { Certificate } from './certificate.js';

/** Output port for persisting {@link Certificate} aggregates. */
export interface CertificateRepository {
  findById(id: number): Promise<Certificate | null>;
  findByVerificationCode(code: string): Promise<Certificate | null>;
  /** Most recent first. */
  listByStudent(studentId: number): Promise<Certificate[]>;
  /** True when certificates were already issued for the payment (idempotent event handling). */
  existsForPayment(paymentId: number): Promise<boolean>;
  save(certificate: Certificate): Promise<void>;
}

export const CERTIFICATE_REPOSITORY = Symbol('CertificateRepository');
