import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port.js';
import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import { toBogota } from '../../domain/bogota-time.js';
import type { DocumentType } from '../../domain/catalogs.js';
import { computeSoftwareSecurityCode, computeUniqueCode, qrUrl } from '../../domain/document-codes.js';
import type { DocumentLine } from '../../domain/document-line.js';
import {
  type BillingReference,
  type Discrepancy,
  ElectronicDocument,
  type PaymentMeans,
} from '../../domain/electronic-document.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../../domain/electronic-document.repository.js';
import { dianFileNames } from '../../domain/file-naming.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../../domain/issuer-config.repository.js';
import {
  NUMBERING_RESOLUTION_REPOSITORY,
  type NumberingResolutionRepository,
} from '../../domain/numbering-resolution.repository.js';
import type { Party } from '../../domain/party.js';
import { CERTIFICATE_STORE, type CertificateStorePort } from '../ports/certificate-store.port.js';
import { UBL_DOCUMENT_BUILDER, type UblDocumentBuilderPort } from '../ports/ubl-document-builder.port.js';
import { XML_SIGNER, type XmlSignerPort } from '../ports/xml-signer.port.js';

export interface IssueRequest {
  type: DocumentType;
  customer: Party;
  lines: DocumentLine[];
  paymentMeans: PaymentMeans;
  notes?: string | null;
  billingReference?: BillingReference | null;
  discrepancy?: Discrepancy | null;
  sourcePaymentId?: number | null;
}

/**
 * Numbers, generates and signs a document in one transaction
 * (legacy `api/dian/generate_invoice.php` steps 1–10, corrected):
 *
 * 1. The issuer configuration must be complete and a valid certificate
 *    configured — documents are never stored unsigned.
 * 2. The active resolution of the type is locked (`SELECT … FOR UPDATE`), so
 *    two concurrent issuances can never take the same consecutive; if
 *    anything fails afterwards the transaction rolls back and the number is
 *    not consumed.
 * 3. CUFE (technical key) or CUDE (software PIN), security code and QR are
 *    computed from the same formatted amounts written in the XML.
 */
@Injectable()
export class DocumentIssuer {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly issuerConfigs: IssuerConfigRepository,
    @Inject(NUMBERING_RESOLUTION_REPOSITORY) private readonly resolutions: NumberingResolutionRepository,
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(CERTIFICATE_STORE) private readonly certificates: CertificateStorePort,
    @Inject(UBL_DOCUMENT_BUILDER) private readonly builder: UblDocumentBuilderPort,
    @Inject(XML_SIGNER) private readonly signer: XmlSignerPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  /** Returns the persisted `signed` document (not yet sent). */
  async issue(request: IssueRequest): Promise<ElectronicDocument> {
    const issuer = await this.issuerConfigs.get();
    issuer.assertReadyToIssue();
    await this.assertCertificateUsable();

    return this.unitOfWork.runInTransaction(async () => {
      const resolution = await this.resolutions.lockActive(request.type);
      if (!resolution) {
        throw new BusinessRuleViolationError(
          `No hay una numeración activa para el tipo de documento "${request.type}".`,
          'NO_ACTIVE_RESOLUTION',
        );
      }
      const issuedAt = toBogota(this.clock.now());
      const reserved = resolution.reserveNext(issuedAt.date, issuer.environment);
      const document = ElectronicDocument.issue({ ...request, reserved, environment: issuer.environment, issuedAt });

      const totals = document.totals;
      const key = request.type === 'fv' ? resolution.technicalKey : issuer.softwarePin;
      if (!key) {
        throw new BusinessRuleViolationError(
          'La resolución no tiene clave técnica configurada.',
          'TECHNICAL_KEY_REQUIRED',
        );
      }
      const uniqueCode = computeUniqueCode({
        type: request.type,
        number: reserved.number,
        issueDate: issuedAt.date,
        issueTime: issuedAt.time,
        lineExtensionCents: totals.lineExtensionCents,
        vatCents: totals.taxCents,
        payableCents: totals.payableCents,
        issuerNit: issuer.nit,
        customerIdNumber: request.customer.idNumber,
        key,
        environment: issuer.environment,
      });
      const securityCode = computeSoftwareSecurityCode(issuer.softwareId, issuer.softwarePin, reserved.number);
      const qr = qrUrl(issuer.environment, uniqueCode);
      const xml = this.builder.build({ document, issuer, resolution, uniqueCode, securityCode, qrUrl: qr });

      document.sign({
        uniqueCode,
        securityCode,
        qrUrl: qr,
        signedXml: await this.signer.sign(xml),
        fileNames: dianFileNames({
          mode: issuer.fileNaming,
          type: request.type,
          issuerNit: issuer.nit,
          consecutive: reserved.consecutive,
          year: Number(issuedAt.date.slice(0, 4)),
          providerCode: issuer.providerCode,
          softwareId: issuer.softwareId,
        }),
      });
      await this.resolutions.save(resolution);
      await this.documents.save(document);
      return document;
    });
  }

  private async assertCertificateUsable(): Promise<void> {
    const certificate = await this.certificates.describe();
    if (!certificate) {
      throw new BusinessRuleViolationError(
        'No hay un certificado de firma digital configurado. No se emiten documentos sin firma.',
        'CERTIFICATE_NOT_CONFIGURED',
      );
    }
    const now = this.clock.now();
    if (now < certificate.validFrom || now > certificate.validTo) {
      throw new BusinessRuleViolationError('El certificado de firma digital no está vigente.', 'CERTIFICATE_EXPIRED', {
        validTo: certificate.validTo.toISOString(),
      });
    }
  }
}
