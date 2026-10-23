import { toOffset, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type {
  AccountMovementRow,
  LedgerCriteria,
  LedgerLineRow,
  LedgerQueryPort,
} from '../application/ports/ledger-query.port.js';
import type { PostingLogPort } from '../application/ports/posting-log.port.js';
import type { VoucherSequencePort } from '../application/ports/voucher-sequence.port.js';
import type { Account } from '../domain/account.js';
import type { AccountRepository } from '../domain/account.repository.js';
import type { AccountingPeriod } from '../domain/accounting-period.js';
import type { AccountingPeriodRepository } from '../domain/accounting-period.repository.js';
import type { JournalEntry } from '../domain/journal-entry.js';
import type { JournalEntryRepository, JournalEntrySearchCriteria } from '../domain/journal-entry.repository.js';
import type { PostingRule } from '../domain/posting-rule.js';
import type { PostingRuleRepository } from '../domain/posting-rule.repository.js';
import type { ThirdParty } from '../domain/third-party.js';
import type { ThirdPartyRepository, ThirdPartySearchCriteria } from '../domain/third-party.repository.js';
import { formatVoucherNumber, type VoucherType } from '../domain/voucher-type.js';

const page = <T>(items: T[], request: PageRequest): Paginated<T> => {
  const offset = toOffset(request);
  return { items: items.slice(offset, offset + request.limit), total: items.length, ...request };
};

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  readonly store = new InMemoryStore<JournalEntry>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findBySource(sourceType: string, sourceId: string) {
    return this.store.all().find((e) => e.source?.type === sourceType && e.source.id === sourceId) ?? null;
  }
  async findReversalOf(entryId: number) {
    return this.store.all().find((e) => e.reversalOfId === entryId && e.status === 'posted') ?? null;
  }
  async search(criteria: JournalEntrySearchCriteria, request: PageRequest) {
    const direction = criteria.order === 'asc' ? 1 : -1;
    const matches = this.store
      .all()
      .filter((e) => !criteria.from || e.date >= criteria.from)
      .filter((e) => !criteria.to || e.date <= criteria.to)
      .filter((e) => !criteria.type || e.type === criteria.type)
      .filter((e) => !criteria.status || e.status === criteria.status)
      .sort((a, b) => direction * (a.date.localeCompare(b.date) || (a.id as number) - (b.id as number)));
    return page(matches, request);
  }
  async countDraftsInPeriod(periodId: number) {
    return this.store.all().filter((e) => e.periodId === periodId && e.status === 'draft').length;
  }
  async save(entry: JournalEntry) {
    this.store.save(entry);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  readonly store = new InMemoryStore<Account>();
  constructor(private readonly entries?: InMemoryJournalEntryRepository) {}

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((a) => ids.includes(a.id as number));
  }
  async findByCode(code: string) {
    return this.store.all().find((a) => a.code.toString() === code) ?? null;
  }
  async findAll() {
    return this.store.all().sort((a, b) => a.code.toString().localeCompare(b.code.toString()));
  }
  async hasMovements(id: number) {
    return (this.entries?.store.all() ?? []).some((e) => e.lines.some((l) => l.accountId === id));
  }
  async hasChildren(id: number) {
    return this.store.all().some((a) => a.parentId === id);
  }
  async save(account: Account) {
    this.store.save(account);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryThirdPartyRepository implements ThirdPartyRepository {
  readonly store = new InMemoryStore<ThirdParty>();
  constructor(private readonly entries?: InMemoryJournalEntryRepository) {}

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((t) => ids.includes(t.id as number));
  }
  async findByDocumentNumber(documentNumber: string) {
    return this.store.all().find((t) => t.document.number === documentNumber) ?? null;
  }
  async search(criteria: ThirdPartySearchCriteria, request: PageRequest) {
    const term = criteria.search?.toLowerCase();
    const matches = this.store
      .all()
      .filter((t) => criteria.isActive === undefined || t.isActive === criteria.isActive)
      .filter((t) => !term || t.name.toLowerCase().includes(term) || t.document.number.includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    return page(matches, request);
  }
  async hasMovements(id: number) {
    return (this.entries?.store.all() ?? []).some((e) => e.lines.some((l) => l.thirdPartyId === id));
  }
  async save(party: ThirdParty) {
    this.store.save(party);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}

export class InMemoryAccountingPeriodRepository implements AccountingPeriodRepository {
  readonly store = new InMemoryStore<AccountingPeriod>();

  private sorted() {
    return this.store
      .all()
      .sort((a, b) => b.startDate.localeCompare(a.startDate) || (b.id as number) - (a.id as number));
  }
  async findById(id: number) {
    return this.store.get(id);
  }
  async findAll() {
    return this.sorted();
  }
  async findOverlapping(startDate: string, endDate: string) {
    return this.sorted().filter((p) => p.overlaps(startDate, endDate));
  }
  async findContaining(day: string) {
    return this.sorted().filter((p) => p.contains(day));
  }
  async save(period: AccountingPeriod) {
    this.store.save(period);
  }
}

export class InMemoryPostingRuleRepository implements PostingRuleRepository {
  readonly rules = new Map<string, number>();

  async findAll(): Promise<PostingRule[]> {
    return [...this.rules].map(([key, accountId]) => ({ key, accountId }));
  }
  async save(rule: PostingRule) {
    this.rules.set(rule.key, rule.accountId);
  }
  async delete(key: string) {
    this.rules.delete(key);
  }
}

export class InMemoryVoucherSequence implements VoucherSequencePort {
  private readonly counters = new Map<VoucherType, number>();
  async next(type: VoucherType) {
    const next = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, next);
    return formatVoucherNumber(next);
  }
}

/** Ledger read model computed from the in-memory entries (posted only). */
export class InMemoryLedgerQuery implements LedgerQueryPort {
  constructor(
    private readonly entries: InMemoryJournalEntryRepository,
    private readonly thirdParties?: InMemoryThirdPartyRepository,
  ) {}

  async movementsByAccount(criteria: LedgerCriteria): Promise<AccountMovementRow[]> {
    const totals = new Map<number, AccountMovementRow>();
    for (const line of await this.lines(criteria)) {
      const row = totals.get(line.accountId) ?? {
        accountId: line.accountId,
        debit: Money.zero(),
        credit: Money.zero(),
      };
      totals.set(line.accountId, { ...row, debit: row.debit.add(line.debit), credit: row.credit.add(line.credit) });
    }
    return [...totals.values()];
  }

  async lines(criteria: LedgerCriteria): Promise<LedgerLineRow[]> {
    return this.entries.store
      .all()
      .filter((e) => e.status === 'posted')
      .filter((e) => (!criteria.from || e.date >= criteria.from) && (!criteria.to || e.date <= criteria.to))
      .filter((e) => !criteria.entryType || e.type === criteria.entryType)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.id as number) - (b.id as number))
      .flatMap((e) =>
        e.lines
          .filter((l) => criteria.thirdPartyId === undefined || l.thirdPartyId === criteria.thirdPartyId)
          .filter((l) => !criteria.accountIds || criteria.accountIds.includes(l.accountId))
          .map((l) => ({
            entryId: e.id as number,
            entryDate: e.date,
            entryType: e.type,
            entryNumber: e.number as string,
            entryDescription: e.description,
            accountId: l.accountId,
            thirdPartyId: l.thirdPartyId,
            thirdPartyName:
              l.thirdPartyId === null ? null : (this.thirdParties?.store.get(l.thirdPartyId)?.name ?? null),
            description: l.description,
            debit: l.debit,
            credit: l.credit,
          })),
      );
  }

  async countPostedEntries(criteria: LedgerCriteria): Promise<number> {
    return new Set((await this.lines(criteria)).map((line) => line.entryId)).size;
  }
}

export class RecordingPostingLog implements PostingLogPort {
  readonly warnings: { message: string; context: Record<string, unknown> }[] = [];
  warn(message: string, context: Record<string, unknown>): void {
    this.warnings.push({ message, context });
  }
}
