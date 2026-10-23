import { Module, type OnModuleInit } from '@nestjs/common';
import { AutomaticEntryPoster } from './application/automatic-entry-poster.js';
import { ChangeThirdPartyStatusUseCase } from './application/change-third-party-status.use-case.js';
import { ClosePeriodUseCase } from './application/close-period.use-case.js';
import { CreateAccountUseCase } from './application/create-account.use-case.js';
import { CreateJournalEntryUseCase } from './application/create-journal-entry.use-case.js';
import { CreatePeriodUseCase } from './application/create-period.use-case.js';
import { CreateThirdPartyUseCase } from './application/create-third-party.use-case.js';
import { DeleteAccountUseCase } from './application/delete-account.use-case.js';
import { DeleteDraftJournalEntryUseCase } from './application/delete-draft-journal-entry.use-case.js';
import { DeletePostingRuleUseCase } from './application/delete-posting-rule.use-case.js';
import { DeleteThirdPartyUseCase } from './application/delete-third-party.use-case.js';
import { ExportReportUseCase } from './application/export-report.use-case.js';
import { GetAccountingDashboardUseCase } from './application/get-accounting-dashboard.use-case.js';
import { GetAuxiliaryLedgerUseCase } from './application/get-auxiliary-ledger.use-case.js';
import { GetBalanceSheetUseCase } from './application/get-balance-sheet.use-case.js';
import { GetCurrentPeriodUseCase } from './application/get-current-period.use-case.js';
import { GetGeneralJournalUseCase } from './application/get-general-journal.use-case.js';
import { GetGeneralLedgerUseCase } from './application/get-general-ledger.use-case.js';
import { GetIncomeStatementUseCase } from './application/get-income-statement.use-case.js';
import { GetJournalEntryUseCase } from './application/get-journal-entry.use-case.js';
import { GetTrialBalanceUseCase } from './application/get-trial-balance.use-case.js';
import { JournalEntryBooker } from './application/journal-entry-booker.js';
import { JournalEntryLookups } from './application/journal-entry-lookups.js';
import { LedgerReader } from './application/ledger-reader.js';
import { ListAccountsUseCase } from './application/list-accounts.use-case.js';
import { ListJournalEntriesUseCase } from './application/list-journal-entries.use-case.js';
import { ListPeriodsUseCase } from './application/list-periods.use-case.js';
import { ListPostingRulesUseCase } from './application/list-posting-rules.use-case.js';
import { ListThirdPartiesUseCase } from './application/list-third-parties.use-case.js';
import { LEDGER_QUERY } from './application/ports/ledger-query.port.js';
import { POSTING_LOG } from './application/ports/posting-log.port.js';
import { REPORT_RENDERER } from './application/ports/report-renderer.port.js';
import { VOUCHER_SEQUENCE } from './application/ports/voucher-sequence.port.js';
import { PostExpenseEntryUseCase } from './application/post-expense-entry.use-case.js';
import { PostJournalEntryUseCase } from './application/post-journal-entry.use-case.js';
import { PostPaymentEntryUseCase } from './application/post-payment-entry.use-case.js';
import { PostPayrollEntryUseCase } from './application/post-payroll-entry.use-case.js';
import { ReopenPeriodUseCase } from './application/reopen-period.use-case.js';
import { ReverseJournalEntryUseCase } from './application/reverse-journal-entry.use-case.js';
import { ReversePaymentEntryUseCase } from './application/reverse-payment-entry.use-case.js';
import { SeedDefaultPostingRulesUseCase } from './application/seed-default-posting-rules.use-case.js';
import { SeedStandardPucUseCase } from './application/seed-standard-puc.use-case.js';
import { SetPostingRuleUseCase } from './application/set-posting-rule.use-case.js';
import { UpdateAccountUseCase } from './application/update-account.use-case.js';
import { UpdateDraftJournalEntryUseCase } from './application/update-draft-journal-entry.use-case.js';
import { UpdateThirdPartyUseCase } from './application/update-third-party.use-case.js';
import { VoidJournalEntryUseCase } from './application/void-journal-entry.use-case.js';
import { ACCOUNT_REPOSITORY } from './domain/account.repository.js';
import { ACCOUNTING_PERIOD_REPOSITORY } from './domain/accounting-period.repository.js';
import { JOURNAL_ENTRY_REPOSITORY } from './domain/journal-entry.repository.js';
import { POSTING_RULE_REPOSITORY } from './domain/posting-rule.repository.js';
import { THIRD_PARTY_REPOSITORY } from './domain/third-party.repository.js';
import { CsvReportRenderer } from './infrastructure/adapters/csv-report-renderer.js';
import { MultiFormatReportRenderer } from './infrastructure/adapters/multi-format-report-renderer.js';
import { PdfReportRenderer } from './infrastructure/adapters/pdf-report-renderer.js';
import { XlsxReportRenderer } from './infrastructure/adapters/xlsx-report-renderer.js';
import { LoggerPostingLog } from './infrastructure/adapters/logger-posting-log.js';
import { AccountingEventSubscriber } from './infrastructure/events/accounting-event-subscriber.js';
import { AccountingReportsController } from './infrastructure/http/accounting-reports.controller.js';
import { AccountsController } from './infrastructure/http/accounts.controller.js';
import { JournalEntriesController } from './infrastructure/http/journal-entries.controller.js';
import { PeriodsController } from './infrastructure/http/periods.controller.js';
import { PostingRulesController } from './infrastructure/http/posting-rules.controller.js';
import { ThirdPartiesController } from './infrastructure/http/third-parties.controller.js';
import {
  TypeOrmAccountingPeriodRepository,
  TypeOrmAccountRepository,
  TypeOrmJournalEntryRepository,
  TypeOrmLedgerQuery,
  TypeOrmPostingRuleRepository,
  TypeOrmThirdPartyRepository,
  TypeOrmVoucherSequence,
} from './infrastructure/persistence/index.js';

/**
 * Accounting context (legacy `apreu/accounting/**`): chart of accounts (PUC),
 * third parties, periods, double-entry vouchers, books and financial
 * statements, plus automatic entries from finance and payroll events.
 * Composition root binding the ports to their adapters.
 */
@Module({
  controllers: [
    AccountsController,
    ThirdPartiesController,
    PeriodsController,
    JournalEntriesController,
    AccountingReportsController,
    PostingRulesController,
  ],
  providers: [
    // Accounts
    ListAccountsUseCase,
    CreateAccountUseCase,
    UpdateAccountUseCase,
    DeleteAccountUseCase,
    SeedStandardPucUseCase,
    // Third parties
    ListThirdPartiesUseCase,
    CreateThirdPartyUseCase,
    UpdateThirdPartyUseCase,
    ChangeThirdPartyStatusUseCase,
    DeleteThirdPartyUseCase,
    // Periods
    ListPeriodsUseCase,
    GetCurrentPeriodUseCase,
    CreatePeriodUseCase,
    ClosePeriodUseCase,
    ReopenPeriodUseCase,
    // Journal entries
    JournalEntryBooker,
    JournalEntryLookups,
    ListJournalEntriesUseCase,
    GetJournalEntryUseCase,
    CreateJournalEntryUseCase,
    UpdateDraftJournalEntryUseCase,
    DeleteDraftJournalEntryUseCase,
    PostJournalEntryUseCase,
    VoidJournalEntryUseCase,
    ReverseJournalEntryUseCase,
    // Reports
    LedgerReader,
    GetAccountingDashboardUseCase,
    GetTrialBalanceUseCase,
    GetGeneralJournalUseCase,
    GetGeneralLedgerUseCase,
    GetAuxiliaryLedgerUseCase,
    GetIncomeStatementUseCase,
    GetBalanceSheetUseCase,
    ExportReportUseCase,
    // Automatic entries
    AutomaticEntryPoster,
    PostPaymentEntryUseCase,
    ReversePaymentEntryUseCase,
    PostExpenseEntryUseCase,
    PostPayrollEntryUseCase,
    ListPostingRulesUseCase,
    SetPostingRuleUseCase,
    DeletePostingRuleUseCase,
    SeedDefaultPostingRulesUseCase,
    AccountingEventSubscriber,
    // Adapters
    { provide: ACCOUNT_REPOSITORY, useClass: TypeOrmAccountRepository },
    { provide: THIRD_PARTY_REPOSITORY, useClass: TypeOrmThirdPartyRepository },
    { provide: ACCOUNTING_PERIOD_REPOSITORY, useClass: TypeOrmAccountingPeriodRepository },
    { provide: JOURNAL_ENTRY_REPOSITORY, useClass: TypeOrmJournalEntryRepository },
    { provide: POSTING_RULE_REPOSITORY, useClass: TypeOrmPostingRuleRepository },
    { provide: VOUCHER_SEQUENCE, useClass: TypeOrmVoucherSequence },
    { provide: LEDGER_QUERY, useClass: TypeOrmLedgerQuery },
    { provide: POSTING_LOG, useClass: LoggerPostingLog },
    CsvReportRenderer,
    XlsxReportRenderer,
    PdfReportRenderer,
    { provide: REPORT_RENDERER, useClass: MultiFormatReportRenderer },
  ],
})
export class AccountingModule implements OnModuleInit {
  constructor(private readonly subscriber: AccountingEventSubscriber) {}

  /** Subscribes to `finance.*` and `hr.payroll-period-paid` integration events. */
  onModuleInit(): void {
    this.subscriber.subscribe();
  }
}
