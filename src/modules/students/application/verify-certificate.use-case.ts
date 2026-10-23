import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { documentLabel } from './certificate-text.js';

/** Public answer of the certificate verification; personal data is minimized. */
export interface CertificateVerificationView {
  valid: boolean;
  status: string;
  type: string;
  schoolName: string;
  studentName: string | null;
  /** Only the last 4 digits are disclosed. */
  document: string | null;
  gradeName: string | null;
  academicYear: number | null;
  issuedAt: Date | null;
}

const mask = (value: string): string => `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;

/** Public verification of a certificate by its code (new in v2). */
@Injectable()
export class VerifyCertificateUseCase implements UseCase<string, CertificateVerificationView> {
  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
  ) {}

  async execute(code: string): Promise<CertificateVerificationView> {
    const certificate = await this.certificates.findByVerificationCode(code.trim());
    if (!certificate) throw new NotFoundError('Certificado con código', code);
    const snapshot = certificate.snapshot;
    return {
      valid: certificate.isValid,
      status: certificate.status,
      type: certificate.type,
      schoolName: (await this.settings.load()).schoolName,
      studentName: snapshot?.studentName ?? null,
      document: snapshot?.documentNumber
        ? `${documentLabel(snapshot.documentType)} ${mask(snapshot.documentNumber)}`
        : null,
      gradeName: snapshot?.gradeName ?? null,
      academicYear: snapshot?.academicYear ?? null,
      issuedAt: certificate.createdAt,
    };
  }
}
