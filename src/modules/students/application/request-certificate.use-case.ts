import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { Certificate, type CertificateType } from '../domain/certificate.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toCertificateView, type CertificateView } from './views.js';

export interface RequestCertificateInput {
  actor: AuthenticatedActor;
  studentId: number;
  type?: CertificateType;
  notes?: string | null;
}

/**
 * A student/guardian (or the office) requests a certificate; it stays
 * `pending` until an admin approves it. Only one open request per type.
 */
@Injectable()
export class RequestCertificateUseCase implements UseCase<RequestCertificateInput, CertificateView> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ actor, studentId, type, notes }: RequestCertificateInput): Promise<CertificateView> {
    await this.access.load(actor, studentId, [Role.ADMIN]);
    const certificate = Certificate.request({
      studentId,
      type,
      notes,
      requestedBy: actor.userId,
      requestedAt: this.clock.now(),
    });
    const existing = await this.certificates.listByStudent(studentId);
    if (existing.some((c) => c.status === 'pending' && c.type === certificate.type)) {
      throw new BusinessRuleViolationError(
        'Ya existe una solicitud de certificado pendiente.',
        'CERTIFICATE_REQUEST_PENDING',
      );
    }
    await this.certificates.save(certificate);
    return toCertificateView(certificate);
  }
}
