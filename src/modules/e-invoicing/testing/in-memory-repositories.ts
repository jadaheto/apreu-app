import { InMemoryStore } from '../../../shared/testing/fakes.js';
import { toOffset, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import type { DocumentType } from '../domain/catalogs.js';
import type { ElectronicDocument } from '../domain/electronic-document.js';
import type {
  DocumentCounts,
  DocumentSearchCriteria,
  DocumentStats,
  ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { IssuerConfig } from '../domain/issuer-config.js';
import type { IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import type { NumberingResolution } from '../domain/numbering-resolution.js';
import type { NumberingResolutionRepository } from '../domain/numbering-resolution.repository.js';

const countBy = (documents: ElectronicDocument[]): DocumentCounts => {
  const counts: DocumentCounts = { fv: {}, nc: {}, nd: {} };
  documents.forEach((d) => (counts[d.type][d.status] = (counts[d.type][d.status] ?? 0) + 1));
  return counts;
};

export class InMemoryElectronicDocumentRepository implements ElectronicDocumentRepository {
  readonly emailed = new Map<number, Date>();

  async markEmailSent(id: number, sentAt: Date): Promise<void> {
    this.emailed.set(id, sentAt);
  }

  readonly store = new InMemoryStore<ElectronicDocument>();
  saves = 0;

  async findById(id: number): Promise<ElectronicDocument | null> {
    return this.store.get(id);
  }

  async findBySourcePayment(paymentId: number, type: DocumentType): Promise<ElectronicDocument[]> {
    return this.store.all().filter((d) => d.sourcePaymentId === paymentId && d.type === type);
  }

  async search(criteria: DocumentSearchCriteria, page: PageRequest): Promise<Paginated<ElectronicDocument>> {
    const term = criteria.search?.toLowerCase();
    const matches = this.inRange(criteria)
      .filter((d) => !criteria.type || d.type === criteria.type)
      .filter((d) => !criteria.status || d.status === criteria.status)
      .filter((d) => !criteria.sourcePaymentIds || criteria.sourcePaymentIds.includes(d.sourcePaymentId ?? -1))
      .filter((d) => !criteria.excludeStatuses?.includes(d.status))
      .filter((d) => !term || d.number.toLowerCase().includes(term) || d.customer.name.toLowerCase().includes(term))
      .sort((a, b) => (b.id as number) - (a.id as number));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async stats(criteria: Pick<DocumentSearchCriteria, 'from' | 'to'>): Promise<DocumentStats> {
    const documents = this.inRange(criteria);
    return {
      counts: countBy(documents),
      acceptedInvoicesTotalCents: documents
        .filter((d) => d.type === 'fv' && d.isAccepted)
        .reduce((sum, d) => sum + d.totals.payableCents, 0),
    };
  }

  async findPendingSubmission(limit: number): Promise<ElectronicDocument[]> {
    return this.store
      .all()
      .filter((d) => d.canBeSubmitted)
      .slice(0, limit);
  }

  async creditedTotalCents(invoiceId: number): Promise<number> {
    return this.store
      .all()
      .filter((d) => d.type === 'nc' && d.billingReference?.documentId === invoiceId && d.status !== 'rejected')
      .reduce((sum, d) => sum + d.totals.payableCents, 0);
  }

  async testSetCounts(): Promise<DocumentCounts> {
    return countBy(this.store.all().filter((d) => d.operation === 'SendTestSetAsync'));
  }

  async save(document: ElectronicDocument): Promise<void> {
    this.saves++;
    this.store.save(document);
    const pending = document.submissions.filter((s) => s.id === null).length;
    if (pending) document.assignSubmissionIds(Array.from({ length: pending }, (_, i) => this.saves * 100 + i));
  }

  private inRange(criteria: Pick<DocumentSearchCriteria, 'from' | 'to'>): ElectronicDocument[] {
    return this.store
      .all()
      .filter((d) => (!criteria.from || d.issueDate >= criteria.from) && (!criteria.to || d.issueDate <= criteria.to));
  }
}

export class InMemoryNumberingResolutionRepository implements NumberingResolutionRepository {
  readonly store = new InMemoryStore<NumberingResolution>();
  readonly locks: DocumentType[] = [];

  async findById(id: number): Promise<NumberingResolution | null> {
    return this.store.get(id);
  }
  async list(): Promise<NumberingResolution[]> {
    return this.store.all();
  }
  async findActive(docType: DocumentType): Promise<NumberingResolution | null> {
    return this.store.all().find((r) => r.docType === docType && r.isActive) ?? null;
  }
  async lockActive(docType: DocumentType): Promise<NumberingResolution | null> {
    this.locks.push(docType);
    return this.findActive(docType);
  }
  async findByPrefix(prefix: string): Promise<NumberingResolution[]> {
    return this.store.all().filter((r) => r.prefix === prefix);
  }
  async save(resolution: NumberingResolution): Promise<void> {
    this.store.save(resolution);
  }
}

export class InMemoryIssuerConfigRepository implements IssuerConfigRepository {
  constructor(public config: IssuerConfig = IssuerConfig.empty()) {}
  async get(): Promise<IssuerConfig> {
    return this.config;
  }
  async save(config: IssuerConfig): Promise<void> {
    this.config = config;
  }
}
