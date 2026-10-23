import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../../shared/application/ports/event-bus.port.js';
import { BusinessRuleViolationError, ExternalServiceError } from '../../../../shared/domain/domain-error.js';
import { Amounts } from '../../domain/amounts.js';
import { toBogota } from '../../domain/bogota-time.js';
import { type DianOperation, type DianResponse, interpretDianResponse } from '../../domain/dian-response.js';
import type { ElectronicDocument } from '../../domain/electronic-document.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../../domain/electronic-document.repository.js';
import type { IssuerConfig } from '../../domain/issuer-config.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../../domain/issuer-config.repository.js';
import { E_INVOICING_EVENTS, type InvoiceAcceptedPayload, type InvoiceRejectedPayload } from '../integration-events.js';
import {
  ATTACHED_DOCUMENT_BUILDER,
  type AttachedDocumentBuilderPort,
} from '../ports/attached-document-builder.port.js';
import { DIAN_GATEWAY, type DianGatewayPort } from '../ports/dian-gateway.port.js';
import { XML_SIGNER, type XmlSignerPort } from '../ports/xml-signer.port.js';
import { ZIP_ARCHIVER, type ZipArchiverPort } from '../ports/zip-archiver.port.js';

/**
 * Talks to the DIAN for an already signed document and applies the answer.
 *
 * - Habilitation with TestSetId → `SendTestSetAsync` (stays `submitted` until
 *   `GetStatusZip`); otherwise `SendBillSync`.
 * - Transport failures leave the document in `send_error` to be retried with
 *   the very same signed XML (legacy marked them `rejected`).
 * - When a document reaches a final state it publishes
 *   `e-invoicing.invoice-accepted` / `e-invoicing.invoice-rejected`, and an
 *   accepted document gets its signed `AttachedDocument`.
 */
@Injectable()
export class DocumentSubmitter {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly issuerConfigs: IssuerConfigRepository,
    @Inject(DIAN_GATEWAY) private readonly gateway: DianGatewayPort,
    @Inject(ZIP_ARCHIVER) private readonly zipper: ZipArchiverPort,
    @Inject(ATTACHED_DOCUMENT_BUILDER) private readonly attachedDocuments: AttachedDocumentBuilderPort,
    @Inject(XML_SIGNER) private readonly signer: XmlSignerPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  /** Sends a `signed`/`send_error` document. */
  async submit(document: ElectronicDocument): Promise<ElectronicDocument> {
    document.assertSubmittable();
    const issuer = await this.issuerConfigs.get();
    if (issuer.environment !== document.environment) {
      throw new BusinessRuleViolationError(
        'El documento fue numerado para otro ambiente DIAN; emita uno nuevo en el ambiente actual.',
        'ENVIRONMENT_CHANGED',
      );
    }
    const fileNames = document.fileNames!;
    const zip = this.zipper.zip(`${fileNames.xml}.xml`, document.signedXml!);
    const zipName = `${fileNames.zip}.zip`;
    if (issuer.usesTestSet) {
      const testSetId = issuer.testSetId!;
      return this.exchange(document, issuer, 'SendTestSetAsync', () =>
        this.gateway.sendTestSetAsync(document.environment, zipName, zip, testSetId),
      );
    }
    return this.exchange(document, issuer, 'SendBillSync', () =>
      this.gateway.sendBillSync(document.environment, zipName, zip),
    );
  }

  /** Queries `GetStatusZip` for a `submitted` document. Transport errors are re-thrown after being logged in the history. */
  async checkStatus(document: ElectronicDocument): Promise<ElectronicDocument> {
    document.assertStatusQueryable();
    const issuer = await this.issuerConfigs.get();
    return this.exchange(document, issuer, 'GetStatusZip', () =>
      this.gateway.getStatusZip(document.environment, document.trackId!),
    );
  }

  /**
   * Builds and signs the AttachedDocument of an accepted document if missing.
   * Throws when it cannot be generated (no ApplicationResponse, signing error).
   */
  async ensureAttachedDocument(document: ElectronicDocument, issuer?: IssuerConfig): Promise<string> {
    if (document.attachedDocument) return document.attachedDocument;
    if (!document.isAccepted || !document.applicationResponse) {
      throw new BusinessRuleViolationError(
        'El AttachedDocument requiere un documento validado con su ApplicationResponse de la DIAN.',
        'ATTACHED_DOCUMENT_UNAVAILABLE',
      );
    }
    const config = issuer ?? (await this.issuerConfigs.get());
    const xml = this.attachedDocuments.build(document, config, toBogota(this.clock.now()));
    document.attachContainer(await this.signer.sign(xml));
    await this.documents.save(document);
    return document.attachedDocument!;
  }

  private async exchange(
    document: ElectronicDocument,
    issuer: IssuerConfig,
    operation: DianOperation,
    call: () => Promise<DianResponse>,
  ): Promise<ElectronicDocument> {
    let response: DianResponse;
    try {
      response = await call();
    } catch (error) {
      if (!(error instanceof ExternalServiceError)) throw error;
      document.recordTransportError(operation, error.message, this.clock.now());
      await this.documents.save(document);
      if (operation === 'GetStatusZip') throw error;
      return document;
    }

    const reachedFinal = document.applyResponse(operation, response, interpretDianResponse(response), this.clock.now());
    await this.documents.save(document);
    if (!reachedFinal) return document;

    if (document.isAccepted) {
      // The container is regenerated on demand (GET …/attached-document) if this attempt fails;
      // acceptance must never be lost because of it.
      await this.ensureAttachedDocument(document, issuer).catch(() => undefined);
    }
    await this.publishOutcome(document);
    return document;
  }

  private async publishOutcome(document: ElectronicDocument): Promise<void> {
    const occurredAt = this.clock.now();
    if (document.isAccepted) {
      const payload: InvoiceAcceptedPayload = {
        dianInvoiceId: document.id as number,
        number: document.number,
        cufe: document.uniqueCode!,
        paymentId: document.sourcePaymentId,
        total: Amounts.toNumber(document.totals.payableCents),
        documentType: document.type,
      };
      await this.events.publish({ name: E_INVOICING_EVENTS.invoiceAccepted, occurredAt, payload: { ...payload } });
      return;
    }
    const payload: InvoiceRejectedPayload = {
      dianInvoiceId: document.id as number,
      number: document.number,
      errors: [...document.errors],
      documentType: document.type,
    };
    await this.events.publish({ name: E_INVOICING_EVENTS.invoiceRejected, occurredAt, payload: { ...payload } });
  }
}
