import { Email } from '../../../../shared/domain/value-objects/email.vo.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { AccountCode } from '../../domain/account-code.js';
import { Account } from '../../domain/account.js';
import { AccountingPeriod } from '../../domain/accounting-period.js';
import { IdentityDocument } from '../../domain/identity-document.js';
import { JournalEntry } from '../../domain/journal-entry.js';
import { JournalLine } from '../../domain/journal-line.js';
import { ThirdParty } from '../../domain/third-party.js';
import { AccountOrmEntity } from './account.orm-entity.js';
import { AccountingPeriodOrmEntity } from './accounting-period.orm-entity.js';
import { JournalEntryOrmEntity } from './journal-entry.orm-entity.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';
import { ThirdPartyOrmEntity } from './third-party.orm-entity.js';

/** Translates `accounting_accounts` rows ↔ {@link Account}. */
export const AccountMapper = {
  toDomain(row: AccountOrmEntity): Account {
    return Account.restore(row.id, {
      code: AccountCode.fromPersistence(row.code),
      name: row.name,
      type: row.type,
      isTransactional: row.isTransactional,
      parentId: row.parentId,
      createdAt: row.createdAt,
    });
  },
  toPersistence(account: Account): AccountOrmEntity {
    const row = new AccountOrmEntity();
    if (account.id !== null) row.id = account.id;
    row.code = account.code.toString();
    row.name = account.name;
    row.type = account.type;
    row.isTransactional = account.isTransactional;
    row.parentId = account.parentId;
    return row;
  },
};

const safeEmail = (raw: string | null): Email | null => {
  if (!raw) return null;
  try {
    return Email.create(raw);
  } catch {
    return null;
  }
};

/** Translates `accounting_third_parties` rows ↔ {@link ThirdParty}. */
export const ThirdPartyMapper = {
  toDomain(row: ThirdPartyOrmEntity): ThirdParty {
    return ThirdParty.restore(row.id, {
      document: IdentityDocument.fromPersistence(row.documentType, row.documentNumber, row.dv),
      name: row.name,
      // Legacy rows were never validated: an invalid e-mail is dropped instead of breaking reads.
      email: safeEmail(row.email),
      phone: row.phone,
      address: row.address,
      city: row.city,
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  },
  toPersistence(party: ThirdParty): ThirdPartyOrmEntity {
    const row = new ThirdPartyOrmEntity();
    if (party.id !== null) row.id = party.id;
    row.documentType = party.document.type;
    row.documentNumber = party.document.number;
    row.dv = party.document.dv;
    row.name = party.name;
    row.email = party.email?.toString() ?? null;
    row.phone = party.phone;
    row.address = party.address;
    row.city = party.city;
    row.isActive = party.isActive;
    return row;
  },
};

/** Translates `accounting_periods` rows ↔ {@link AccountingPeriod}. */
export const AccountingPeriodMapper = {
  toDomain(row: AccountingPeriodOrmEntity): AccountingPeriod {
    return AccountingPeriod.restore(row.id, {
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      closedAt: row.closedAt,
      closedBy: row.closedBy,
      reopenedAt: row.reopenedAt,
      reopenedBy: row.reopenedBy,
      reopenReason: row.reopenReason,
      createdAt: row.createdAt,
    });
  },
  toPersistence(period: AccountingPeriod): AccountingPeriodOrmEntity {
    const row = new AccountingPeriodOrmEntity();
    if (period.id !== null) row.id = period.id;
    row.name = period.name;
    row.startDate = period.startDate;
    row.endDate = period.endDate;
    row.status = period.status;
    row.closedAt = period.closedAt;
    row.closedBy = period.closedBy;
    row.reopenedAt = period.reopenedAt;
    row.reopenedBy = period.reopenedBy;
    row.reopenReason = period.reopenReason;
    return row;
  },
};

/** Placeholder stored in `entry_number` while an entry is a draft (the column is NOT NULL and unique per type). */
export const DRAFT_NUMBER_PREFIX = 'BORRADOR-';

/** Translates `accounting_journal_entries` + lines ↔ {@link JournalEntry}. */
export const JournalEntryMapper = {
  toDomain(row: JournalEntryOrmEntity): JournalEntry {
    const lines = [...(row.lines ?? [])]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((line) =>
        JournalLine.restore({
          accountId: line.accountId,
          thirdPartyId: line.thirdPartyId,
          description: line.description,
          debit: Money.of(line.debit),
          credit: Money.of(line.credit),
        }),
      );
    return JournalEntry.restore(row.id, {
      periodId: row.periodId,
      date: row.entryDate,
      type: row.entryType,
      number: row.status === 'draft' || row.entryNumber.startsWith(DRAFT_NUMBER_PREFIX) ? null : row.entryNumber,
      description: row.description,
      status: row.status,
      lines,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      postedAt: row.postedAt,
      postedBy: row.postedBy,
      voidedAt: row.voidedAt,
      voidedBy: row.voidedBy,
      voidReason: row.voidReason,
      source: row.sourceType && row.sourceId ? { type: row.sourceType, id: row.sourceId } : null,
      reversalOfId: row.reversalOfId,
    });
  },

  /** Header row; `draftNumber` is used while the entry has no consecutive. */
  toPersistence(entry: JournalEntry, draftNumber: string): JournalEntryOrmEntity {
    const row = new JournalEntryOrmEntity();
    if (entry.id !== null) row.id = entry.id;
    row.periodId = entry.periodId;
    row.entryDate = entry.date;
    row.entryType = entry.type;
    row.entryNumber = entry.number ?? draftNumber;
    row.description = entry.description;
    row.totalDebit = entry.totalDebit.amount.toFixed(2);
    row.totalCredit = entry.totalCredit.amount.toFixed(2);
    row.status = entry.status;
    row.createdBy = entry.createdBy;
    row.postedAt = entry.postedAt;
    row.postedBy = entry.postedBy;
    row.voidedAt = entry.voidedAt;
    row.voidedBy = entry.voidedBy;
    row.voidReason = entry.voidReason;
    row.sourceType = entry.source?.type ?? null;
    row.sourceId = entry.source?.id ?? null;
    row.reversalOfId = entry.reversalOfId;
    return row;
  },

  linesToPersistence(entryId: number, entry: JournalEntry): Partial<JournalLineOrmEntity>[] {
    return entry.lines.map((line) => ({
      entryId,
      accountId: line.accountId,
      thirdPartyId: line.thirdPartyId,
      description: line.description,
      debit: line.debit.amount.toFixed(2),
      credit: line.credit.amount.toFixed(2),
    }));
  },
};
