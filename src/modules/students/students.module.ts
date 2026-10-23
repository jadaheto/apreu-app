import { join } from 'node:path';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context.js';
import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import { EVENT_BUS, type EventBusPort } from '../../shared/application/ports/event-bus.port.js';
import { ENVIRONMENT, type Environment } from '../../shared/infrastructure/config/environment.js';
import { ApproveCertificateUseCase } from './application/approve-certificate.use-case.js';
import { CancelCertificateUseCase } from './application/cancel-certificate.use-case.js';
import { CertificateIssuer } from './application/certificate-issuer.js';
import { CertificateSnapshotFactory } from './application/certificate-snapshot.factory.js';
import { ChangeStudentStatusUseCase } from './application/change-student-status.use-case.js';
import { ClassroomPlacement } from './application/classroom-placement.js';
import { CreateGuardianUseCase } from './application/create-guardian.use-case.js';
import { CreateIncidentUseCase } from './application/create-incident.use-case.js';
import { EnrollStudentUseCase } from './application/enroll-student.use-case.js';
import { FindGuardianByDocumentUseCase } from './application/find-guardian-by-document.use-case.js';
import { GetCertificateDocumentUseCase } from './application/get-certificate-document.use-case.js';
import { RenderCertificatePdfUseCase } from './application/render-certificate-pdf.use-case.js';
import { CERTIFICATE_RENDERER } from './application/ports/certificate-renderer.port.js';
import { PdfCertificateRenderer } from './infrastructure/adapters/pdf-certificate.renderer.js';
import { GetGuardianUseCase } from './application/get-guardian.use-case.js';
import { GetIncidentKpisUseCase } from './application/get-incident-kpis.use-case.js';
import { GetIncidentUseCase } from './application/get-incident.use-case.js';
import { GetPortalDashboardUseCase } from './application/get-portal-dashboard.use-case.js';
import { GetStudentDetailsUseCase } from './application/get-student-details.use-case.js';
import { GetStudentFinancialSummaryUseCase } from './application/get-student-financial-summary.use-case.js';
import { GetStudentIdCardUseCase } from './application/get-student-id-card.use-case.js';
import { GetStudentPhotoUseCase } from './application/get-student-photo.use-case.js';
import { GetStudentProfileUseCase } from './application/get-student-profile.use-case.js';
import { GuardianViewAssembler } from './application/guardian-view.assembler.js';
import { IncidentViewAssembler } from './application/incident-view.assembler.js';
import { PAYMENT_REGISTERED, type PaymentRegisteredPayload } from './application/integration-events.js';
import { IssueCertificateUseCase } from './application/issue-certificate.use-case.js';
import { IssueCertificatesOnPaymentUseCase } from './application/issue-certificates-on-payment.use-case.js';
import { LinkStudentGuardianUseCase } from './application/link-student-guardian.use-case.js';
import { ListIncidentsUseCase } from './application/list-incidents.use-case.js';
import { ListStudentCertificatesUseCase } from './application/list-student-certificates.use-case.js';
import { ListStudentIncidentsUseCase } from './application/list-student-incidents.use-case.js';
import { ListStudentsUseCase } from './application/list-students.use-case.js';
import { PortalAccountProvisioner } from './application/portal-account-provisioner.js';
import { FILE_STORAGE } from './application/ports/file-storage.port.js';
import { QR_SIGNER } from './application/ports/qr-signer.port.js';
import { SECRET_GENERATOR } from './application/ports/secret-generator.port.js';
import { USER_ACCOUNTS } from './application/ports/user-account.port.js';
import { ProvisionPortalAccountsUseCase } from './application/provision-portal-accounts.use-case.js';
import { ReportStudentIncidentUseCase } from './application/report-student-incident.use-case.js';
import { RequestCertificateUseCase } from './application/request-certificate.use-case.js';
import { ResetPortalPasswordUseCase } from './application/reset-portal-password.use-case.js';
import { ResolvePortalContextUseCase } from './application/resolve-portal-context.use-case.js';
import { ReviewIncidentUseCase } from './application/review-incident.use-case.js';
import { StudentAccessPolicy } from './application/student-access.policy.js';
import { StudentViewAssembler } from './application/student-view.assembler.js';
import { UpdateGuardianUseCase } from './application/update-guardian.use-case.js';
import { UpdateStudentUseCase } from './application/update-student.use-case.js';
import { UploadStudentPhotoUseCase } from './application/upload-student-photo.use-case.js';
import { VerifyCertificateUseCase } from './application/verify-certificate.use-case.js';
import { VerifyStudentQrUseCase } from './application/verify-student-qr.use-case.js';
import { ACADEMIC_PERFORMANCE } from './domain/academic-performance.port.js';
import { CERTIFICATE_CONCEPT_CATALOG } from './domain/certificate-concept-catalog.port.js';
import { CERTIFICATE_REPOSITORY } from './domain/certificate.repository.js';
import { CLASSROOM_DIRECTORY } from './domain/classroom-directory.port.js';
import { GUARDIAN_REPOSITORY } from './domain/guardian.repository.js';
import { INCIDENT_REPOSITORY } from './domain/incident.repository.js';
import { INSTITUTION_SETTINGS } from './domain/institution-settings.port.js';
import { STUDENT_CODE_SEQUENCE } from './domain/student-code-sequence.port.js';
import { STUDENT_FINANCE } from './domain/student-finance.port.js';
import { STUDENT_REPOSITORY } from './domain/student.repository.js';
import { CryptoSecretGenerator } from './infrastructure/adapters/crypto-secret-generator.js';
import { HmacQrSigner } from './infrastructure/adapters/hmac-qr-signer.js';
import { LocalDiskFileStorage } from './infrastructure/adapters/local-disk-file-storage.js';
import { CertificatesController, PublicCertificatesController } from './infrastructure/http/certificates.controller.js';
import { GuardiansController } from './infrastructure/http/guardians.controller.js';
import { IncidentsController } from './infrastructure/http/incidents.controller.js';
import { PortalController } from './infrastructure/http/portal.controller.js';
import { StudentDocumentsController } from './infrastructure/http/student-documents.controller.js';
import { StudentsController } from './infrastructure/http/students.controller.js';
import {
  SqlAcademicPerformance,
  SqlCertificateConceptCatalog,
  SqlClassroomDirectory,
  SqlInstitutionSettings,
  SqlStudentCodeSequence,
  SqlStudentFinance,
  SqlUserAccounts,
  TypeOrmCertificateRepository,
  TypeOrmGuardianRepository,
  TypeOrmIncidentRepository,
  TypeOrmStudentRepository,
} from './infrastructure/persistence/index.js';

/**
 * Students context: enrollment, student records, guardians, portal
 * accounts, ID card with signed QR, certificates, incidents and the
 * student/guardian portal. Composition root binding ports to adapters.
 *
 * Subscribes to `finance.payment-registered` to issue certificates.
 */
@Module({
  controllers: [
    StudentsController,
    StudentDocumentsController,
    GuardiansController,
    CertificatesController,
    PublicCertificatesController,
    IncidentsController,
    PortalController,
  ],
  providers: [
    // Application services
    StudentAccessPolicy,
    StudentViewAssembler,
    GuardianViewAssembler,
    IncidentViewAssembler,
    ClassroomPlacement,
    PortalAccountProvisioner,
    CertificateSnapshotFactory,
    CertificateIssuer,
    // Use cases
    ListStudentsUseCase,
    EnrollStudentUseCase,
    GetStudentProfileUseCase,
    GetStudentDetailsUseCase,
    UpdateStudentUseCase,
    ChangeStudentStatusUseCase,
    UploadStudentPhotoUseCase,
    GetStudentPhotoUseCase,
    LinkStudentGuardianUseCase,
    FindGuardianByDocumentUseCase,
    GetGuardianUseCase,
    CreateGuardianUseCase,
    UpdateGuardianUseCase,
    ProvisionPortalAccountsUseCase,
    ResetPortalPasswordUseCase,
    GetStudentIdCardUseCase,
    VerifyStudentQrUseCase,
    GetStudentFinancialSummaryUseCase,
    ListStudentCertificatesUseCase,
    IssueCertificateUseCase,
    RequestCertificateUseCase,
    ApproveCertificateUseCase,
    CancelCertificateUseCase,
    GetCertificateDocumentUseCase,
    RenderCertificatePdfUseCase,
    { provide: CERTIFICATE_RENDERER, useClass: PdfCertificateRenderer },
    VerifyCertificateUseCase,
    IssueCertificatesOnPaymentUseCase,
    CreateIncidentUseCase,
    ListIncidentsUseCase,
    GetIncidentKpisUseCase,
    GetIncidentUseCase,
    ReviewIncidentUseCase,
    ReportStudentIncidentUseCase,
    ListStudentIncidentsUseCase,
    ResolvePortalContextUseCase,
    GetPortalDashboardUseCase,
    // Repositories and cross-context readers
    { provide: STUDENT_REPOSITORY, useClass: TypeOrmStudentRepository },
    { provide: GUARDIAN_REPOSITORY, useClass: TypeOrmGuardianRepository },
    { provide: INCIDENT_REPOSITORY, useClass: TypeOrmIncidentRepository },
    { provide: CERTIFICATE_REPOSITORY, useClass: TypeOrmCertificateRepository },
    { provide: STUDENT_CODE_SEQUENCE, useClass: SqlStudentCodeSequence },
    { provide: CLASSROOM_DIRECTORY, useClass: SqlClassroomDirectory },
    { provide: INSTITUTION_SETTINGS, useClass: SqlInstitutionSettings },
    { provide: STUDENT_FINANCE, useClass: SqlStudentFinance },
    { provide: ACADEMIC_PERFORMANCE, useClass: SqlAcademicPerformance },
    {
      provide: CERTIFICATE_CONCEPT_CATALOG,
      useClass: SqlCertificateConceptCatalog,
    },
    { provide: USER_ACCOUNTS, useClass: SqlUserAccounts },
    // External adapters
    { provide: SECRET_GENERATOR, useClass: CryptoSecretGenerator },
    {
      provide: QR_SIGNER,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => HmacQrSigner.create(env.studentQrSecret ?? undefined, env.jwt.secret),
    },
    {
      provide: FILE_STORAGE,
      inject: [ENVIRONMENT, TenantContext],
      useFactory: (env: Environment, tenants: TenantContext) =>
        new LocalDiskFileStorage(() => join(env.storage.uploadsDir, tenants.require().slug)),
    },
  ],
})
export class StudentsModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    private readonly issueCertificatesOnPayment: IssueCertificatesOnPaymentUseCase,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(PAYMENT_REGISTERED, async (event) => {
      await this.issueCertificatesOnPayment.execute(event.payload as PaymentRegisteredPayload);
    });
  }
}
