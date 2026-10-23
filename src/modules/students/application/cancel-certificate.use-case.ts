import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { toCertificateView, type CertificateView } from './views.js';

export interface CancelCertificateInput {
  certificateId: number;
  reason: string;
}

/** Voids a certificate or rejects a request; it can no longer be printed or verified. */
@Injectable()
export class CancelCertificateUseCase implements UseCase<CancelCertificateInput, CertificateView> {
  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
  ) {}

  async execute({ certificateId, reason }: CancelCertificateInput): Promise<CertificateView> {
    const certificate = await this.certificates.findById(certificateId);
    if (!certificate) throw new NotFoundError('Certificado', certificateId);
    certificate.cancel(reason);
    await this.certificates.save(certificate);
    return toCertificateView(certificate);
  }
}
