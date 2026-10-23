import type { Account } from '../domain/account.js';
import type { JournalEntry, JournalEntryStatus } from '../domain/journal-entry.js';
import type { ThirdParty } from '../domain/third-party.js';
import { VOUCHER_TYPE_LABELS, type VoucherType } from '../domain/voucher-type.js';

export interface JournalLineView {
  accountId: number;
  accountCode: string | null;
  accountName: string | null;
  thirdPartyId: number | null;
  thirdPartyName: string | null;
  description: string | null;
  debit: number;
  credit: number;
}

/** Read model of a journal entry (header plus, when requested, its lines). */
export interface JournalEntryView {
  id: number;
  periodId: number;
  date: string;
  type: VoucherType;
  typeLabel: string;
  number: string | null;
  displayNumber: string | null;
  description: string;
  status: JournalEntryStatus;
  totalDebit: number;
  totalCredit: number;
  createdBy: number | null;
  createdAt: Date | null;
  postedAt: Date | null;
  postedBy: number | null;
  voidedAt: Date | null;
  voidedBy: number | null;
  voidReason: string | null;
  sourceType: string | null;
  sourceId: string | null;
  reversalOfId: number | null;
  lines?: JournalLineView[];
}

/** Names used to enrich lines; missing entries are rendered as `null`. */
export interface LineLookups {
  accounts: ReadonlyMap<number, Account>;
  thirdParties: ReadonlyMap<number, ThirdParty>;
}

export const toJournalEntryView = (entry: JournalEntry, lookups?: LineLookups): JournalEntryView => ({
  id: entry.id as number,
  periodId: entry.periodId,
  date: entry.date,
  type: entry.type,
  typeLabel: VOUCHER_TYPE_LABELS[entry.type],
  number: entry.number,
  displayNumber: entry.displayNumber,
  description: entry.description,
  status: entry.status,
  totalDebit: entry.totalDebit.amount,
  totalCredit: entry.totalCredit.amount,
  createdBy: entry.createdBy,
  createdAt: entry.createdAt,
  postedAt: entry.postedAt,
  postedBy: entry.postedBy,
  voidedAt: entry.voidedAt,
  voidedBy: entry.voidedBy,
  voidReason: entry.voidReason,
  sourceType: entry.source?.type ?? null,
  sourceId: entry.source?.id ?? null,
  reversalOfId: entry.reversalOfId,
  ...(lookups && {
    lines: entry.lines.map((line) => {
      const account = lookups.accounts.get(line.accountId);
      return {
        accountId: line.accountId,
        accountCode: account?.code.toString() ?? null,
        accountName: account?.name ?? null,
        thirdPartyId: line.thirdPartyId,
        thirdPartyName: line.thirdPartyId === null ? null : (lookups.thirdParties.get(line.thirdPartyId)?.name ?? null),
        description: line.description,
        debit: line.debit.amount,
        credit: line.credit.amount,
      };
    }),
  }),
});
