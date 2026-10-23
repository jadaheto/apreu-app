import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { Certificate, type CertificateType } from '../domain/certificate.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import type { Student } from '../domain/student.js';
import { CertificateSnapshotFactory } from './certificate-snapshot.factory.js';
import { CERTIFICATE_ISSUED, type CertificateIssuedPayload } from './integration-events.js';
import { SECRET_GENERATOR, type SecretGeneratorPort } from './ports/secret-generator.port.js';

export interface IssueOptions {
  type?: CertificateType;
  paymentId?: number | null;
  createdBy: number | null;
  notes?: string | null;
}

/**
 * Makes certificates valid: freezes the student snapshot, assigns a random
 * verification code, persists and publishes `students.certificate-issued`.
 * Shared by manual issuance, approval of requests and issuance on payment.
 */
@Injectable()
export class CertificateIssuer {
  constructor(
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(SECRET_GENERATOR) private readonly secrets: SecretGeneratorPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly snapshots: CertificateSnapshotFactory,
  ) {}

  async issue(student: Student, options: IssueOptions): Promise<Certificate> {
    const certificate = Certificate.issue({
      ...options,
      studentId: student.id as number,
      verificationCode: this.secrets.verificationCode(),
      snapshot: await this.snapshots.snapshotOf(student),
      issuedAt: this.clock.now(),
    });
    await this.certificates.save(certificate);
    await this.published(certificate);
    return certificate;
  }

  async approve(certificate: Certificate, student: Student): Promise<void> {
    certificate.approve(this.secrets.verificationCode(), await this.snapshots.snapshotOf(student));
    await this.certificates.save(certificate);
    await this.published(certificate);
  }

  private published(certificate: Certificate): Promise<void> {
    return this.events.publish({
      name: CERTIFICATE_ISSUED,
      occurredAt: this.clock.now(),
      payload: {
        certificateId: certificate.id as number,
        studentId: certificate.studentId,
        type: certificate.type,
        paymentId: certificate.paymentId,
        verificationCode: certificate.verificationCode as string,
      } satisfies CertificateIssuedPayload,
    });
  }
}
