import { Module } from '@nestjs/common';
import { ApplyCreditBalanceUseCase } from './application/apply-credit-balance.use-case.js';
import { CancelChargeUseCase } from './application/cancel-charge.use-case.js';
import { ChargeBatchPlanner } from './application/charge-batch-planner.js';
import { CreateBillingConceptUseCase } from './application/create-billing-concept.use-case.js';
import { CreateExpenseUseCase } from './application/create-expense.use-case.js';
import { CreateIndividualChargeUseCase } from './application/create-individual-charge.use-case.js';
import { GenerateChargeBatchUseCase } from './application/generate-charge-batch.use-case.js';
import { GenerateCollectionFileUseCase } from './application/generate-collection-file.use-case.js';
import { GeneratePayrollDisbursementFileUseCase } from './application/generate-payroll-disbursement-file.use-case.js';
import { GetAccountStatementUseCase } from './application/get-account-statement.use-case.js';
import { GetAgingReportUseCase } from './application/get-aging-report.use-case.js';
import { GetChargeDocumentUseCase } from './application/get-charge-document.use-case.js';
import { GetChargesSummaryUseCase } from './application/get-charges-summary.use-case.js';
import { GetFinanceDashboardUseCase } from './application/get-finance-dashboard.use-case.js';
import { GetReceiptUseCase } from './application/get-receipt.use-case.js';
import { GetReconciliationUseCase } from './application/get-reconciliation.use-case.js';
import { GetTuitionScheduleUseCase } from './application/get-tuition-schedule.use-case.js';
import { ListBillingConceptsUseCase } from './application/list-billing-concepts.use-case.js';
import { ListChargesUseCase } from './application/list-charges.use-case.js';
import { ListExpenseCategoriesUseCase } from './application/list-expense-categories.use-case.js';
import { ListExpensesUseCase } from './application/list-expenses.use-case.js';
import { ListMyStudentsUseCase } from './application/list-my-students.use-case.js';
import { ListPaymentsUseCase } from './application/list-payments.use-case.js';
import { ListStudentChargesUseCase } from './application/list-student-charges.use-case.js';
import { ListStudentPaymentsUseCase } from './application/list-student-payments.use-case.js';
import { AGING_SOURCE } from './application/ports/aging-source.port.js';
import { CHARGE_QUERIES } from './application/ports/charge-queries.port.js';
import { DASHBOARD_QUERIES } from './application/ports/dashboard-queries.port.js';
import { PAYMENT_QUERIES } from './application/ports/payment-queries.port.js';
import { ReconcilePaymentUseCase } from './application/reconcile-payment.use-case.js';
import { RecordPayrollExpenseUseCase } from './application/record-payroll-expense.use-case.js';
import { RegisterPaymentUseCase } from './application/register-payment.use-case.js';
import { SaveExpenseCategoryUseCase } from './application/save-expense-category.use-case.js';
import { SaveTuitionScheduleUseCase } from './application/save-tuition-schedule.use-case.js';
import { SearchStudentsForBillingUseCase } from './application/search-students-for-billing.use-case.js';
import { SetBillingConceptActiveUseCase } from './application/set-billing-concept-active.use-case.js';
import { StudentAccessPolicy } from './application/student-access.policy.js';
import { UnreconcilePaymentUseCase } from './application/unreconcile-payment.use-case.js';
import { UpdateBillingConceptUseCase } from './application/update-billing-concept.use-case.js';
import { PreviewChargeBatchUseCase } from './application/preview-charge-batch.use-case.js';
import { VoidPaymentUseCase } from './application/void-payment.use-case.js';
import { BILLING_CONCEPT_REPOSITORY } from './domain/billing-concept.repository.js';
import { EXPENSE_CATEGORY_REPOSITORY } from './domain/expense-category.repository.js';
import { EXPENSE_REPOSITORY } from './domain/expense.repository.js';
import { FINANCE_SETTINGS } from './domain/finance-settings.port.js';
import { GRADE_CATALOG } from './domain/grade-catalog.port.js';
import { PAYMENT_REPOSITORY } from './domain/payment.repository.js';
import { PAYROLL_DISBURSEMENT_SOURCE } from './domain/payroll-disbursement-source.port.js';
import { RECEIPT_SEQUENCE } from './domain/receipt-sequence.port.js';
import { STUDENT_CHARGE_REPOSITORY } from './domain/student-charge.repository.js';
import { STUDENT_DIRECTORY } from './domain/student-directory.port.js';
import { STUDENT_LINKS } from './domain/student-links.port.js';
import { TUITION_SCHEDULE_REPOSITORY } from './domain/tuition-schedule.repository.js';
import { PayrollPeriodPaidSubscriber } from './infrastructure/events/payroll-period-paid.subscriber.js';
import { BankFilesController } from './infrastructure/http/bank-files.controller.js';
import { BillingConceptsController } from './infrastructure/http/billing-concepts.controller.js';
import { ChargesController } from './infrastructure/http/charges.controller.js';
import { ExpensesController } from './infrastructure/http/expenses.controller.js';
import { FinanceReportsController } from './infrastructure/http/finance-reports.controller.js';
import { PaymentsController } from './infrastructure/http/payments.controller.js';
import { PortalController } from './infrastructure/http/portal.controller.js';
import { ReceiptsController } from './infrastructure/http/receipts.controller.js';
import { StudentAccountsController } from './infrastructure/http/student-accounts.controller.js';
import { TuitionController } from './infrastructure/http/tuition.controller.js';
import {
  SqlAgingSource,
  SqlChargeQueries,
  SqlDashboardQueries,
  SqlFinanceSettings,
  SqlGradeCatalog,
  SqlPaymentQueries,
  SqlPayrollDisbursementSource,
  SqlReceiptSequence,
  SqlStudentDirectory,
  SqlStudentLinks,
  TypeOrmBillingConceptRepository,
  TypeOrmExpenseCategoryRepository,
  TypeOrmExpenseRepository,
  TypeOrmPaymentRepository,
  TypeOrmStudentChargeRepository,
  TypeOrmTuitionScheduleRepository,
} from './infrastructure/persistence/index.js';

/**
 * Finance context: billing concepts and tuition, student charges, cashier
 * (payments, receipts, credit balance, voiding), portfolio aging, account
 * statements, expenses, manual bank reconciliation, bank flat files and the
 * financial dashboard (analysis 04). Composition root binding ports to adapters.
 *
 * Publishes `finance.payment-registered`, `finance.payment-voided`,
 * `finance.expense-registered` and `finance.credit-applied`; subscribes to
 * `hr.payroll-period-paid`.
 */
@Module({
  controllers: [
    BillingConceptsController,
    TuitionController,
    ChargesController,
    PaymentsController,
    ReceiptsController,
    StudentAccountsController,
    PortalController,
    FinanceReportsController,
    BankFilesController,
    ExpensesController,
  ],
  providers: [
    // Application services
    StudentAccessPolicy,
    ChargeBatchPlanner,
    ListBillingConceptsUseCase,
    CreateBillingConceptUseCase,
    UpdateBillingConceptUseCase,
    SetBillingConceptActiveUseCase,
    GetTuitionScheduleUseCase,
    SaveTuitionScheduleUseCase,
    PreviewChargeBatchUseCase,
    GenerateChargeBatchUseCase,
    CreateIndividualChargeUseCase,
    CancelChargeUseCase,
    ListChargesUseCase,
    GetChargesSummaryUseCase,
    GetChargeDocumentUseCase,
    RegisterPaymentUseCase,
    VoidPaymentUseCase,
    ApplyCreditBalanceUseCase,
    GetReceiptUseCase,
    ListPaymentsUseCase,
    SearchStudentsForBillingUseCase,
    GetAccountStatementUseCase,
    ListStudentChargesUseCase,
    ListStudentPaymentsUseCase,
    ListMyStudentsUseCase,
    GetAgingReportUseCase,
    GetReconciliationUseCase,
    ReconcilePaymentUseCase,
    UnreconcilePaymentUseCase,
    GenerateCollectionFileUseCase,
    GeneratePayrollDisbursementFileUseCase,
    GetFinanceDashboardUseCase,
    CreateExpenseUseCase,
    ListExpensesUseCase,
    ListExpenseCategoriesUseCase,
    SaveExpenseCategoryUseCase,
    RecordPayrollExpenseUseCase,
    PayrollPeriodPaidSubscriber,
    // Repositories
    { provide: BILLING_CONCEPT_REPOSITORY, useClass: TypeOrmBillingConceptRepository },
    { provide: TUITION_SCHEDULE_REPOSITORY, useClass: TypeOrmTuitionScheduleRepository },
    { provide: STUDENT_CHARGE_REPOSITORY, useClass: TypeOrmStudentChargeRepository },
    { provide: PAYMENT_REPOSITORY, useClass: TypeOrmPaymentRepository },
    { provide: EXPENSE_REPOSITORY, useClass: TypeOrmExpenseRepository },
    { provide: EXPENSE_CATEGORY_REPOSITORY, useClass: TypeOrmExpenseCategoryRepository },
    { provide: RECEIPT_SEQUENCE, useClass: SqlReceiptSequence },
    // Read ports over other contexts
    { provide: STUDENT_DIRECTORY, useClass: SqlStudentDirectory },
    { provide: GRADE_CATALOG, useClass: SqlGradeCatalog },
    { provide: STUDENT_LINKS, useClass: SqlStudentLinks },
    { provide: FINANCE_SETTINGS, useClass: SqlFinanceSettings },
    { provide: PAYROLL_DISBURSEMENT_SOURCE, useClass: SqlPayrollDisbursementSource },
    // Reporting queries
    { provide: CHARGE_QUERIES, useClass: SqlChargeQueries },
    { provide: PAYMENT_QUERIES, useClass: SqlPaymentQueries },
    { provide: AGING_SOURCE, useClass: SqlAgingSource },
    { provide: DASHBOARD_QUERIES, useClass: SqlDashboardQueries },
  ],
})
export class FinanceModule {}
