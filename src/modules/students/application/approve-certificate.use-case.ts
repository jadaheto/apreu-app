import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { CertificateIssuer } from './certificate-issuer.js';
import { toCertificateView, type CertificateView } from './views.js';

/** Approves a pending certificate request freezing the student data. */
@Injectable()
export class ApproveCertificateUseCase implements UseCase<number, CertificateView> {
  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly issuer: CertificateIssuer,
  ) {}

  async execute(certificateId: number): Promise<CertificateView> {
    const certificate = await this.certificates.findById(certificateId);
    if (!certificate) throw new NotFoundError('Certificado', certificateId);
    const student = await this.students.findById(certificate.studentId);
    if (!student) throw new NotFoundError('Estudiante', certificate.studentId);
    await this.issuer.approve(certificate, student);
    return toCertificateView(certificate);
  }
}
