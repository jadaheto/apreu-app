import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import type { CertificateType } from '../domain/certificate.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { CertificateIssuer } from './certificate-issuer.js';
import { toCertificateView, type CertificateView } from './views.js';

export interface IssueCertificateInput {
  actor: AuthenticatedActor;
  studentId: number;
  type?: CertificateType;
  notes?: string | null;
}

/** Manual issuance by the school office: the certificate is born `approved` (new in v2). */
@Injectable()
export class IssueCertificateUseCase implements UseCase<IssueCertificateInput, CertificateView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly issuer: CertificateIssuer,
  ) {}

  async execute({ actor, studentId, type, notes }: IssueCertificateInput): Promise<CertificateView> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);
    return toCertificateView(
      await this.issuer.issue(student, {
        type,
        notes,
        createdBy: actor.userId,
      }),
    );
  }
}
