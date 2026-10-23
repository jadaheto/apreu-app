import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../shared/application/ports/event-bus.port.js';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context.js';
import { ENVIRONMENT, type Environment } from '../../shared/infrastructure/config/environment.js';
import { CheckDocumentStatusUseCase } from './application/check-document-status.use-case.js';
import { CreditVoidedPaymentUseCase } from './application/credit-voided-payment.use-case.js';
import { MarkInvoiceEmailedUseCase } from './application/mark-invoice-emailed.use-case.js';
import { GetCatalogUseCase } from './application/get-catalog.use-case.js';
import { GetCertificateInfoUseCase } from './application/get-certificate-info.use-case.js';
import { GetDiagnosticsUseCase } from './application/get-diagnostics.use-case.js';
import { GetDocumentArtifactUseCase } from './application/get-document-artifact.use-case.js';
import { GetDocumentStatsUseCase } from './application/get-document-stats.use-case.js';
import { GetDocumentUseCase } from './application/get-document.use-case.js';
import { GetPortalDocumentArtifactUseCase } from './application/get-portal-document-artifact.use-case.js';
import { GetIssuerConfigUseCase } from './application/get-issuer-config.use-case.js';
import { GetTestSetProgressUseCase } from './application/get-test-set-progress.use-case.js';
import {
  COMMUNICATIONS_EVENTS,
  FINANCE_EVENTS,
  type InvoiceEmailSentPayload,
  type PaymentRegisteredPayload,
  type PaymentVoidedPayload,
} from './application/integration-events.js';
import { InvoiceRegisteredPaymentUseCase } from './application/invoice-registered-payment.use-case.js';
import { IssueCreditNoteUseCase } from './application/issue-credit-note.use-case.js';
import { IssueDebitNoteUseCase } from './application/issue-debit-note.use-case.js';
import { IssueInvoiceUseCase } from './application/issue-invoice.use-case.js';
import { ListDocumentsUseCase } from './application/list-documents.use-case.js';
import { ListPortalStudentDocumentsUseCase } from './application/list-portal-student-documents.use-case.js';
import { ListResolutionsUseCase } from './application/list-resolutions.use-case.js';
import { ATTACHED_DOCUMENT_BUILDER } from './application/ports/attached-document-builder.port.js';
import { INVOICE_PDF_RENDERER } from './application/ports/invoice-pdf-renderer.port.js';
import { BACKGROUND_EXECUTOR } from './application/ports/background-executor.port.js';
import { CERTIFICATE_STORE } from './application/ports/certificate-store.port.js';
import { DIAN_GATEWAY } from './application/ports/dian-gateway.port.js';
import { UBL_DOCUMENT_BUILDER } from './application/ports/ubl-document-builder.port.js';
import { XML_SIGNER } from './application/ports/xml-signer.port.js';
import { ZIP_ARCHIVER } from './application/ports/zip-archiver.port.js';
import { PortalStudentAccess } from './application/portal-student-access.js';
import { RegisterResolutionUseCase } from './application/register-resolution.use-case.js';
import { ResetHabilitationNumberingUseCase } from './application/reset-habilitation-numbering.use-case.js';
import { RetryPendingSubmissionsUseCase } from './application/retry-pending-submissions.use-case.js';
import { RunHabilitationTestSetUseCase } from './application/run-habilitation-test-set.use-case.js';
import { DocumentIssuer } from './application/services/document-issuer.js';
import { DocumentSubmitter } from './application/services/document-submitter.js';
import { SubmitDocumentUseCase } from './application/submit-document.use-case.js';
import { UpdateIssuerConfigUseCase } from './application/update-issuer-config.use-case.js';
import { UpdateResolutionUseCase } from './application/update-resolution.use-case.js';
import { CHARGE_TAX } from './domain/charge-tax.port.js';
import { ELECTRONIC_DOCUMENT_REPOSITORY } from './domain/electronic-document.repository.js';
import { ISSUER_CONFIG_REPOSITORY } from './domain/issuer-config.repository.js';
import { NUMBERING_RESOLUTION_REPOSITORY } from './domain/numbering-resolution.repository.js';
import { PORTAL_STUDENT_LINKS } from './domain/portal-student-links.port.js';
import { PAYER_DIRECTORY } from './domain/payer-directory.port.js';
import { PdfInvoiceRenderer } from './infrastructure/adapters/pdf/pdf-invoice.renderer.js';
import { SoapDianGateway } from './infrastructure/adapters/dian/soap-dian-gateway.js';
import { DetachedExecutor } from './infrastructure/adapters/runtime/detached-executor.js';
import { PemCertificateStore } from './infrastructure/adapters/signing/pem-certificate-store.js';
import { XadesSigner } from './infrastructure/adapters/signing/xades-signer.js';
import { AttachedDocumentBuilder } from './infrastructure/adapters/ubl/attached-document-builder.js';
import { UblDocumentBuilder } from './infrastructure/adapters/ubl/ubl-document-builder.js';
import { ZipArchiver } from './infrastructure/adapters/zip/zip-archiver.js';
import { CatalogsController } from './infrastructure/http/catalogs.controller.js';
import { DocumentsController } from './infrastructure/http/documents.controller.js';
import { HabilitationController } from './infrastructure/http/habilitation.controller.js';
import { IssuerConfigController } from './infrastructure/http/issuer-config.controller.js';
import { PortalDocumentsController } from './infrastructure/http/portal-documents.controller.js';
import { ResolutionsController } from './infrastructure/http/resolutions.controller.js';
import {
  SECRET_CIPHER,
  SecretCipher,
  SettingsIssuerConfigRepository,
  SqlChargeTax,
  SqlPayerDirectory,
  SqlPortalStudentLinks,
  TypeOrmElectronicDocumentRepository,
  TypeOrmNumberingResolutionRepository,
} from './infrastructure/persistence/index.js';

/**
 * E-invoicing context (DIAN electronic invoicing, análisis 05).
 *
 * Environment variables (read here because the shared `Environment` belongs to the kernel):
 * - `E_INVOICING_CERTS_DIR`: absolute directory, outside the application, with `<tenant>.pem`
 *   (private key + certificate) and optional `<tenant>.passphrase`.
 * - `E_INVOICING_SECRET_KEY`: 32-byte base64 key that encrypts the software PIN and technical keys.
 *
 * Student/guardian portal: `GET /e-invoicing/portal/students/{id}/documents[/{docId}/{pdf|xml}]`.
 *
 * Subscribes to `finance.payment-registered` (automatic invoice) and
 * `finance.payment-voided` (automatic annulment credit note); publishes
 * `e-invoicing.invoice-accepted` / `e-invoicing.invoice-rejected`.
 */
@Module({
  controllers: [
    IssuerConfigController,
    ResolutionsController,
    DocumentsController,
    HabilitationController,
    CatalogsController,
    PortalDocumentsController,
  ],
  providers: [
    GetIssuerConfigUseCase,
    UpdateIssuerConfigUseCase,
    GetCertificateInfoUseCase,
    GetDiagnosticsUseCase,
    ListResolutionsUseCase,
    RegisterResolutionUseCase,
    UpdateResolutionUseCase,
    ListDocumentsUseCase,
    GetDocumentStatsUseCase,
    GetDocumentUseCase,
    GetDocumentArtifactUseCase,
    IssueInvoiceUseCase,
    IssueCreditNoteUseCase,
    IssueDebitNoteUseCase,
    SubmitDocumentUseCase,
    CheckDocumentStatusUseCase,
    RetryPendingSubmissionsUseCase,
    RunHabilitationTestSetUseCase,
    GetTestSetProgressUseCase,
    ResetHabilitationNumberingUseCase,
    InvoiceRegisteredPaymentUseCase,
    CreditVoidedPaymentUseCase,
    MarkInvoiceEmailedUseCase,
    GetCatalogUseCase,
    ListPortalStudentDocumentsUseCase,
    GetPortalDocumentArtifactUseCase,
    PortalStudentAccess,
    DocumentIssuer,
    DocumentSubmitter,
    {
      provide: SECRET_CIPHER,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => SecretCipher.fromBase64(env.eInvoicing.secretKey ?? undefined),
    },
    { provide: ISSUER_CONFIG_REPOSITORY, useClass: SettingsIssuerConfigRepository },
    { provide: NUMBERING_RESOLUTION_REPOSITORY, useClass: TypeOrmNumberingResolutionRepository },
    { provide: ELECTRONIC_DOCUMENT_REPOSITORY, useClass: TypeOrmElectronicDocumentRepository },
    { provide: PAYER_DIRECTORY, useClass: SqlPayerDirectory },
    { provide: CHARGE_TAX, useClass: SqlChargeTax },
    { provide: PORTAL_STUDENT_LINKS, useClass: SqlPortalStudentLinks },
    { provide: INVOICE_PDF_RENDERER, useClass: PdfInvoiceRenderer },
    {
      provide: PemCertificateStore,
      inject: [TenantContext, ENVIRONMENT],
      useFactory: (tenants: TenantContext, env: Environment) =>
        new PemCertificateStore({
          directory: env.eInvoicing.certsDir,
          tenantSlug: () => tenants.require().slug,
        }),
    },
    { provide: CERTIFICATE_STORE, useExisting: PemCertificateStore },
    {
      provide: XML_SIGNER,
      inject: [PemCertificateStore, CLOCK],
      useFactory: (store: PemCertificateStore, clock: ClockPort) => new XadesSigner(store, clock),
    },
    {
      provide: DIAN_GATEWAY,
      inject: [PemCertificateStore, CLOCK],
      useFactory: (store: PemCertificateStore, clock: ClockPort) => new SoapDianGateway(store, clock),
    },
    { provide: ZIP_ARCHIVER, useClass: ZipArchiver },
    { provide: UBL_DOCUMENT_BUILDER, useClass: UblDocumentBuilder },
    { provide: ATTACHED_DOCUMENT_BUILDER, useClass: AttachedDocumentBuilder },
    { provide: BACKGROUND_EXECUTOR, useClass: DetachedExecutor },
  ],
})
export class EInvoicingModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    private readonly invoicePayment: InvoiceRegisteredPaymentUseCase,
    private readonly creditVoidedPayment: CreditVoidedPaymentUseCase,
    private readonly markInvoiceEmailed: MarkInvoiceEmailedUseCase,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(FINANCE_EVENTS.paymentRegistered, async (event) => {
      await this.invoicePayment.execute(event.payload as PaymentRegisteredPayload);
    });
    this.events.subscribe(FINANCE_EVENTS.paymentVoided, async (event) => {
      await this.creditVoidedPayment.execute(event.payload as PaymentVoidedPayload);
    });
    this.events.subscribe(COMMUNICATIONS_EVENTS.invoiceEmailSent, async (event) => {
      await this.markInvoiceEmailed.execute(event.payload as InvoiceEmailSentPayload);
    });
  }
}
