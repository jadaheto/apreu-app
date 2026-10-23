import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CERTIFICATE_STORE, type CertificateInfo, type CertificateStorePort } from './ports/certificate-store.port.js';

export interface CertificateInfoView extends CertificateInfo {
  daysToExpire: number;
  expired: boolean;
}

const DAY_MS = 86_400_000;

/** Metadata of the configured signing certificate, with days left before expiry. */
@Injectable()
export class GetCertificateInfoUseCase implements UseCase<void, CertificateInfoView> {
  constructor(
    @Inject(CERTIFICATE_STORE) private readonly certificates: CertificateStorePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<CertificateInfoView> {
    const certificate = await this.certificates.describe();
    if (!certificate) throw new NotFoundError('Certificado de firma digital', 'configurado');
    const now = this.clock.now().getTime();
    return {
      ...certificate,
      daysToExpire: Math.floor((certificate.validTo.getTime() - now) / DAY_MS),
      expired: now > certificate.validTo.getTime() || now < certificate.validFrom.getTime(),
    };
  }
}
