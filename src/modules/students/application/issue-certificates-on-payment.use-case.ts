import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  CERTIFICATE_CONCEPT_CATALOG,
  type CertificateConceptCatalogPort,
  isCertificateConceptName,
} from '../domain/certificate-concept-catalog.port.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { CertificateIssuer } from './certificate-issuer.js';
import type { PaymentRegisteredPayload } from './integration-events.js';

/**
 * Reacts to `finance.payment-registered`: issues one approved certificate
 * per paid charge whose concept is a certificate (legacy
 * `finance/cashier.php:96-115`).
 *
 * - The certificate references the payment id (legacy stored the id of a
 *   `payment_applications` row by mistake, bug B22).
 * - Idempotent: a payment already used for certificates is ignored.
 * Returns the number of certificates issued.
 */
@Injectable()
export class IssueCertificatesOnPaymentUseCase implements UseCase<PaymentRegisteredPayload, number> {
  private readonly logger = new Logger(IssueCertificatesOnPaymentUseCase.name);

  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(CERTIFICATE_CONCEPT_CATALOG)
    private readonly concepts: CertificateConceptCatalogPort,
    private readonly issuer: CertificateIssuer,
  ) {}

  async execute(payment: PaymentRegisteredPayload): Promise<number> {
    const charges = payment.appliedCharges ?? [];
    const catalogIds = new Set(
      await this.concepts.certificateConceptIds([...new Set(charges.map((c) => c.conceptId))]),
    );
    const certificateCharges = charges.filter(
      (c) => catalogIds.has(c.conceptId) || isCertificateConceptName(c.conceptName),
    );
    if (certificateCharges.length === 0 || (await this.certificates.existsForPayment(payment.paymentId))) return 0;

    const student = await this.students.findById(payment.studentId);
    if (!student) {
      this.logger.warn(
        `Pago ${payment.paymentId}: estudiante ${payment.studentId} inexistente, no se emite certificado.`,
      );
      return 0;
    }
    for (const charge of certificateCharges) {
      await this.issuer.issue(student, {
        paymentId: payment.paymentId,
        createdBy: null,
        notes: `Emitido automáticamente por el pago ${payment.receiptNumber} (${charge.conceptName}).`,
      });
    }
    return certificateCharges.length;
  }
}
