import type { AccountLevel } from '../domain/account-code.js';
import type { AccountNature, AccountType } from '../domain/account-type.js';
import type { Paginated } from '../../../shared/domain/pagination.js';
import type { AccountView } from './account-view.js';
import type { JournalEntryView } from './journal-entry-view.js';
import type { PeriodView } from './period-view.js';

/** Trial balance row; balances are signed D − C, presented in debit/credit columns. */
export interface TrialBalanceRowView {
  code: string;
  name: string;
  type: AccountType;
  level: AccountLevel;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceView {
  from: string;
  to: string;
  level: AccountLevel | null;
  rows: TrialBalanceRowView[];
  totals: { debit: number; credit: number; debitBalance: number; creditBalance: number };
  /** ΣD = ΣC and Σ debit balances = Σ credit balances. */
  balanced: boolean;
}

export interface GeneralJournalView {
  from: string;
  to: string;
  entries: Paginated<JournalEntryView>;
  /** Totals of the whole range (all pages). */
  totals: { debit: number; credit: number };
}

/** Balance of an account presented according to its nature. */
export interface NaturalBalanceRowView {
  code: string;
  name: string;
  nature: AccountNature;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
}

export interface AuxiliaryLineView {
  date: string;
  entryId: number;
  voucher: string;
  entryDescription: string;
  thirdPartyId: number | null;
  thirdPartyName: string | null;
  description: string | null;
  debit: number;
  credit: number;
  /** Running balance according to the account nature. */
  balance: number;
}

export interface GeneralLedgerView {
  from: string;
  to: string;
  rows: NaturalBalanceRowView[];
  /** Detailed movements when a single account was requested. */
  lines: AuxiliaryLineView[] | null;
}

export interface AuxiliaryLedgerView {
  from: string;
  to: string;
  account: AccountView;
  thirdPartyId: number | null;
  openingBalance: number;
  lines: AuxiliaryLineView[];
  totals: { debit: number; credit: number };
  closingBalance: number;
}

export interface StatementSectionView {
  rows: { code: string; name: string; amount: number }[];
  total: number;
}

export interface IncomeStatementView {
  from: string;
  to: string;
  income: StatementSectionView;
  costs: StatementSectionView;
  expenses: StatementSectionView;
  grossProfit: number;
  netIncome: number;
}

export interface BalanceSheetView {
  asOf: string;
  assets: StatementSectionView;
  liabilities: StatementSectionView;
  equity: StatementSectionView;
  /** Income − costs − expenses accumulated up to `asOf` not yet closed against 3605/3610. */
  periodResult: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  /** Activo = Pasivo + Patrimonio. */
  balanced: boolean;
}

export interface AccountingDashboardView {
  month: string;
  from: string;
  to: string;
  income: number;
  costs: number;
  expenses: number;
  netIncome: number;
  entriesCount: number;
  latestEntries: JournalEntryView[];
  currentPeriod: PeriodView | null;
}
