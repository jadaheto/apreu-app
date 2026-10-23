import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Role } from '../../../shared/domain/role.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { toCertificateView, type CertificateView } from './views.js';

export interface ListStudentCertificatesInput {
  actor: AuthenticatedActor;
  studentId: number;
}

/** Certificates of a student, most recent first (admin or owners; fixes IDOR of `student/certificate.php`). */
@Injectable()
export class ListStudentCertificatesUseCase implements UseCase<ListStudentCertificatesInput, CertificateView[]> {
  constructor(
    private readonly access: StudentAccessPolicy,
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
  ) {}

  async execute({ actor, studentId }: ListStudentCertificatesInput): Promise<CertificateView[]> {
    await this.access.load(actor, studentId, [Role.ADMIN]);
    return (await this.certificates.listByStudent(studentId)).map(toCertificateView);
  }
}
