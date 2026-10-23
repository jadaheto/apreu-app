import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import { composeCertificateText, type CertificateText } from './certificate-text.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toCertificateView, type CertificateView } from './views.js';

export interface GetCertificateDocumentInput {
  actor: AuthenticatedActor;
  certificateId: number;
}

/** Everything needed to render the printable certificate (layout §4.5b). */
export interface CertificateDocumentView {
  certificate: CertificateView;
  institution: {
    name: string;
    nit: string;
    city: string;
    logo: string | null;
    signature: string | null;
    rectorName: string;
  };
  text: CertificateText;
}

/**
 * Printable study certificate. Only valid (approved/generated) certificates
 * can be printed, by admins or by the student/guardian owner. The PDF is
 * rendered by the client (`window.print()`), as in the legacy system.
 */
@Injectable()
export class GetCertificateDocumentUseCase implements UseCase<GetCertificateDocumentInput, CertificateDocumentView> {
  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    private readonly access: StudentAccessPolicy,
  ) {}

  async execute({ actor, certificateId }: GetCertificateDocumentInput): Promise<CertificateDocumentView> {
    const certificate = await this.certificates.findById(certificateId);
    if (!certificate) throw new NotFoundError('Certificado', certificateId);
    await this.access.load(actor, certificate.studentId, [Role.ADMIN]);
    if (!certificate.isValid || !certificate.snapshot || !certificate.createdAt) {
      throw new BusinessRuleViolationError(
        'El certificado no está disponible para impresión.',
        'CERTIFICATE_NOT_AVAILABLE',
      );
    }
    const institution = await this.settings.load();
    return {
      certificate: toCertificateView(certificate),
      institution: {
        name: institution.schoolName,
        nit: institution.nit,
        city: institution.city,
        logo: institution.logo,
        signature: institution.signature,
        rectorName: institution.rectorName,
      },
      text: composeCertificateText(certificate.snapshot, certificate.createdAt),
    };
  }
}
