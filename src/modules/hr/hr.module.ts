import { Module } from '@nestjs/common';
import { CurrentEmployeeResolver } from './application/current-employee.resolver.js';
import { GetIncomeCertificateUseCase } from './application/documents/get-income-certificate.use-case.js';
import { RenderIncomeCertificateUseCase } from './application/documents/render-income-certificate.use-case.js';
import { GetPayslipUseCase } from './application/documents/get-payslip.use-case.js';
import { IssueEmploymentCertificateUseCase } from './application/documents/issue-employment-certificate.use-case.js';
import { ListPayslipsUseCase } from './application/documents/list-payslips.use-case.js';
import { RenderIssuedDocumentUseCase } from './application/documents/render-issued-document.use-case.js';
import { RenderPayslipUseCase } from './application/documents/render-payslip.use-case.js';
import { VerifyIssuedDocumentUseCase } from './application/documents/verify-issued-document.use-case.js';
import { ChangeEmployeeStatusUseCase } from './application/employees/change-employee-status.use-case.js';
import { GetEmployeeKpisUseCase } from './application/employees/get-employee-kpis.use-case.js';
import { GetEmployeeUseCase } from './application/employees/get-employee.use-case.js';
import { ListEmployeesUseCase } from './application/employees/list-employees.use-case.js';
import { RegisterEmployeeUseCase } from './application/employees/register-employee.use-case.js';
import { RetireEmployeeUseCase } from './application/employees/retire-employee.use-case.js';
import { UpdateEmployeeUseCase } from './application/employees/update-employee.use-case.js';
import { UserAccessSynchronizer } from './application/employees/user-access.synchronizer.js';
import { ApproveLeaveUseCase } from './application/leaves/approve-leave.use-case.js';
import { CancelLeaveUseCase } from './application/leaves/cancel-leave.use-case.js';
import { ListLeavesUseCase } from './application/leaves/list-leaves.use-case.js';
import { ListMyLeavesUseCase } from './application/leaves/list-my-leaves.use-case.js';
import { RejectLeaveUseCase } from './application/leaves/reject-leave.use-case.js';
import { RequestLeaveUseCase } from './application/leaves/request-leave.use-case.js';
import { ApprovePayrollPeriodUseCase } from './application/payroll/approve-payroll-period.use-case.js';
import { CalculatePayrollPeriodUseCase } from './application/payroll/calculate-payroll-period.use-case.js';
import { CancelPayrollPeriodUseCase } from './application/payroll/cancel-payroll-period.use-case.js';
import { ConfigurePayrollParametersUseCase } from './application/payroll/configure-payroll-parameters.use-case.js';
import { CreatePayrollPeriodUseCase } from './application/payroll/create-payroll-period.use-case.js';
import { GetPayrollKpisUseCase } from './application/payroll/get-payroll-kpis.use-case.js';
import { GetPayrollParametersUseCase } from './application/payroll/get-payroll-parameters.use-case.js';
import { GetPayrollPeriodDetailUseCase } from './application/payroll/get-payroll-period-detail.use-case.js';
import { ListPayrollPeriodsUseCase } from './application/payroll/list-payroll-periods.use-case.js';
import { PayPayrollPeriodUseCase } from './application/payroll/pay-payroll-period.use-case.js';
import { PayrollParametersProvider } from './application/payroll/payroll-parameters.provider.js';
import { RegisterPayrollNoveltyUseCase } from './application/payroll/register-payroll-novelty.use-case.js';
import { RemovePayrollNoveltyUseCase } from './application/payroll/remove-payroll-novelty.use-case.js';
import { DOCUMENT_RENDERER } from './application/ports/document-renderer.port.js';
import { SECURE_RANDOM } from './application/ports/secure-random.port.js';
import { GetMyDashboardUseCase } from './application/self-service/get-my-dashboard.use-case.js';
import { GetMyEmployeeProfileUseCase } from './application/self-service/get-my-employee-profile.use-case.js';
import { UpdateMyContactInfoUseCase } from './application/self-service/update-my-contact-info.use-case.js';
import { CreateStickerUseCase } from './application/stickers/create-sticker.use-case.js';
import { DeleteStickerUseCase } from './application/stickers/delete-sticker.use-case.js';
import { GetStickerStatsUseCase } from './application/stickers/get-sticker-stats.use-case.js';
import { ListMyPendingStickersUseCase } from './application/stickers/list-my-pending-stickers.use-case.js';
import { ListStickersUseCase } from './application/stickers/list-stickers.use-case.js';
import { MarkStickerReadUseCase } from './application/stickers/mark-sticker-read.use-case.js';
import { StickerViewAssembler } from './application/stickers/sticker-view.assembler.js';
import { INSTITUTION_PROFILE } from './domain/documents/institution-profile.port.js';
import { ISSUED_DOCUMENT_REPOSITORY } from './domain/documents/issued-document.js';
import { EMPLOYEE_REPOSITORY } from './domain/employees/employee.repository.js';
import { USER_ACCOUNTS } from './domain/employees/user-account.port.js';
import { LEAVE_REQUEST_REPOSITORY } from './domain/leaves/leave-request.repository.js';
import { PAYROLL_PARAMETERS_REPOSITORY } from './domain/payroll/payroll-parameters.repository.js';
import {
  PAYROLL_NOVELTY_REPOSITORY,
  PAYROLL_PAYMENT_REPOSITORY,
  PAYROLL_PERIOD_REPOSITORY,
} from './domain/payroll/payroll.repositories.js';
import { EMPLOYEE_STICKER_REPOSITORY } from './domain/stickers/employee-sticker.repository.js';
import { CryptoSecureRandom } from './infrastructure/adapters/crypto-secure-random.js';
import { PdfDocumentRenderer } from './infrastructure/adapters/pdf-document-renderer.js';
import { EmployeesController } from './infrastructure/http/employees.controller.js';
import { HrDocumentsController } from './infrastructure/http/hr-documents.controller.js';
import { LeavesController } from './infrastructure/http/leaves.controller.js';
import { MyEmployeeController } from './infrastructure/http/my-employee.controller.js';
import { PayrollParametersController } from './infrastructure/http/payroll-parameters.controller.js';
import { PayrollPeriodsController } from './infrastructure/http/payroll-periods.controller.js';
import { PayslipsController } from './infrastructure/http/payslips.controller.js';
import { StickersController } from './infrastructure/http/stickers.controller.js';
import {
  SqlInstitutionProfile,
  SqlUserAccounts,
  TypeOrmEmployeeRepository,
  TypeOrmEmployeeStickerRepository,
  TypeOrmIssuedDocumentRepository,
  TypeOrmLeaveRequestRepository,
  TypeOrmPayrollNoveltyRepository,
  TypeOrmPayrollParametersRepository,
  TypeOrmPayrollPaymentRepository,
  TypeOrmPayrollPeriodRepository,
} from './infrastructure/persistence/index.js';

/**
 * HR context: employees, payroll (Colombian rules), leaves with approval,
 * payslips and certificates, employee self-service and stickers.
 * Composition root binding the ports to their adapters.
 *
 * Publishes `hr.employee-hired`, `hr.payroll-period-paid` (catalogue) and the
 * additional `hr.employee-retired`, `hr.leave-approved`.
 */
@Module({
  controllers: [
    EmployeesController,
    LeavesController,
    PayrollParametersController,
    PayrollPeriodsController,
    PayslipsController,
    MyEmployeeController,
    HrDocumentsController,
    StickersController,
  ],
  providers: [
    // Application services
    CurrentEmployeeResolver,
    PayrollParametersProvider,
    UserAccessSynchronizer,
    StickerViewAssembler,
    // Employees
    RegisterEmployeeUseCase,
    UpdateEmployeeUseCase,
    ChangeEmployeeStatusUseCase,
    RetireEmployeeUseCase,
    ListEmployeesUseCase,
    GetEmployeeUseCase,
    GetEmployeeKpisUseCase,
    // Self-service
    GetMyEmployeeProfileUseCase,
    UpdateMyContactInfoUseCase,
    GetMyDashboardUseCase,
    // Leaves
    RequestLeaveUseCase,
    ApproveLeaveUseCase,
    RejectLeaveUseCase,
    CancelLeaveUseCase,
    ListLeavesUseCase,
    ListMyLeavesUseCase,
    // Payroll
    GetPayrollParametersUseCase,
    ConfigurePayrollParametersUseCase,
    CreatePayrollPeriodUseCase,
    ListPayrollPeriodsUseCase,
    GetPayrollPeriodDetailUseCase,
    GetPayrollKpisUseCase,
    RegisterPayrollNoveltyUseCase,
    RemovePayrollNoveltyUseCase,
    CalculatePayrollPeriodUseCase,
    ApprovePayrollPeriodUseCase,
    PayPayrollPeriodUseCase,
    CancelPayrollPeriodUseCase,
    // Documents
    GetPayslipUseCase,
    RenderPayslipUseCase,
    ListPayslipsUseCase,
    IssueEmploymentCertificateUseCase,
    RenderIssuedDocumentUseCase,
    VerifyIssuedDocumentUseCase,
    GetIncomeCertificateUseCase,
    RenderIncomeCertificateUseCase,
    // Stickers
    CreateStickerUseCase,
    ListStickersUseCase,
    GetStickerStatsUseCase,
    ListMyPendingStickersUseCase,
    MarkStickerReadUseCase,
    DeleteStickerUseCase,
    // Ports → adapters
    { provide: EMPLOYEE_REPOSITORY, useClass: TypeOrmEmployeeRepository },
    { provide: LEAVE_REQUEST_REPOSITORY, useClass: TypeOrmLeaveRequestRepository },
    { provide: PAYROLL_PERIOD_REPOSITORY, useClass: TypeOrmPayrollPeriodRepository },
    { provide: PAYROLL_PAYMENT_REPOSITORY, useClass: TypeOrmPayrollPaymentRepository },
    { provide: PAYROLL_NOVELTY_REPOSITORY, useClass: TypeOrmPayrollNoveltyRepository },
    { provide: PAYROLL_PARAMETERS_REPOSITORY, useClass: TypeOrmPayrollParametersRepository },
    { provide: ISSUED_DOCUMENT_REPOSITORY, useClass: TypeOrmIssuedDocumentRepository },
    { provide: EMPLOYEE_STICKER_REPOSITORY, useClass: TypeOrmEmployeeStickerRepository },
    { provide: USER_ACCOUNTS, useClass: SqlUserAccounts },
    { provide: INSTITUTION_PROFILE, useClass: SqlInstitutionProfile },
    { provide: SECURE_RANDOM, useClass: CryptoSecureRandom },
    { provide: DOCUMENT_RENDERER, useClass: PdfDocumentRenderer },
  ],
})
export class HrModule {}
