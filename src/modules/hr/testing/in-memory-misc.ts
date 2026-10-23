import { toOffset, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import { Role } from '../../../shared/domain/role.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { RenderedDocument, DocumentRendererPort } from '../application/ports/document-renderer.port.js';
import type { SecureRandomPort } from '../application/ports/secure-random.port.js';
import type { InstitutionProfile, InstitutionProfilePort } from '../domain/documents/institution-profile.port.js';
import type { IssuedDocument, IssuedDocumentRepository } from '../domain/documents/issued-document.js';
import type { NewUserAccount, UserAccountPort, UserAccountSummary } from '../domain/employees/user-account.port.js';
import type { EmployeeSticker } from '../domain/stickers/employee-sticker.js';
import type {
  EmployeeStickerRepository,
  StickerCriteria,
  StickerScope,
  StickerStats,
} from '../domain/stickers/employee-sticker.repository.js';

/** In-memory `users` table seen through HR's port. */
export class FakeUserAccounts implements UserAccountPort {
  readonly accounts = new Map<number, UserAccountSummary & { passwordHash: string }>();
  private sequence = 100;

  add(email: string, role: Role, name = 'Usuario'): UserAccountSummary {
    const account = { id: ++this.sequence, name, email, role, isActive: true, passwordHash: 'x' };
    this.accounts.set(account.id, account);
    return account;
  }

  async findById(id: number) {
    return this.accounts.get(id) ?? null;
  }

  async findByEmail(email: string) {
    return [...this.accounts.values()].find((a) => a.email === email) ?? null;
  }

  async create(account: NewUserAccount) {
    const id = ++this.sequence;
    this.accounts.set(id, { id, isActive: true, ...account });
    return id;
  }

  async namesByIds(ids: number[]) {
    return new Map(ids.filter((id) => this.accounts.has(id)).map((id) => [id, this.accounts.get(id)!.name]));
  }

  async setActive(userId: number, active: boolean) {
    const account = this.accounts.get(userId);
    if (account) account.isActive = active;
  }
}

export class FakeSecureRandom implements SecureRandomPort {
  private counter = 0;
  temporaryPassword(): string {
    return 'Temporal123';
  }
  verificationCode(): string {
    return `CODE${++this.counter}`;
  }
}

export const TEST_INSTITUTION: InstitutionProfile = {
  name: 'Colegio Prueba',
  nit: '900123456',
  nitVerificationDigit: '7',
  city: 'Bogotá',
  address: 'Calle 1',
  rectorName: 'Rectora Prueba',
  logo: null,
};

export class FakeInstitutionProfile implements InstitutionProfilePort {
  async get() {
    return TEST_INSTITUTION;
  }
}

/** Renders documents as JSON so tests can inspect the input. */
export class FakeDocumentRenderer implements DocumentRendererPort {
  async payslip(document: unknown): Promise<RenderedDocument> {
    return { contentType: 'application/json', fileName: 'payslip.json', body: JSON.stringify(document) };
  }
  async employmentCertificate(content: unknown): Promise<RenderedDocument> {
    return { contentType: 'application/json', fileName: 'certificate.json', body: JSON.stringify(content) };
  }
  async incomeCertificate(document: unknown): Promise<RenderedDocument> {
    return { contentType: 'application/json', fileName: 'income.json', body: JSON.stringify(document) };
  }
}

export class InMemoryIssuedDocumentRepository implements IssuedDocumentRepository {
  readonly store = new InMemoryStore<IssuedDocument<object>>();

  async findByCode(code: string) {
    return (this.store.all().find((d) => d.code === code) as IssuedDocument | undefined) ?? null;
  }

  async save(document: IssuedDocument<object>) {
    this.store.save(document);
  }
}

export class InMemoryStickerRepository implements EmployeeStickerRepository {
  readonly store = new InMemoryStore<EmployeeSticker>();

  async findById(id: number) {
    return this.store.get(id);
  }

  async search(criteria: StickerCriteria, page: PageRequest): Promise<Paginated<EmployeeSticker>> {
    const matches = this.visible(criteria.scope)
      .filter((s) => criteria.employeeId === undefined || s.employeeId === criteria.employeeId)
      .filter((s) => criteria.filter !== 'unread' || !s.isRead)
      .filter((s) => criteria.filter !== 'urgent' || s.priority === 'urgent');
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async stats(scope: StickerScope | null): Promise<StickerStats> {
    const visible = this.visible(scope);
    return {
      total: visible.length,
      unread: visible.filter((s) => !s.isRead).length,
      urgent: visible.filter((s) => !s.isRead && s.priority === 'urgent').length,
    };
  }

  async pendingFor(employeeId: number, limit: number) {
    return this.store
      .all()
      .filter((s) => s.employeeId === employeeId && !s.isRead)
      .sort((a, b) => Number(b.priority === 'urgent') - Number(a.priority === 'urgent'))
      .slice(0, limit);
  }

  async save(sticker: EmployeeSticker) {
    this.store.save(sticker);
  }

  async delete(id: number) {
    this.store.items.delete(id);
  }

  private visible(scope: StickerScope | null): EmployeeSticker[] {
    return this.store.all().filter((s) => !scope || s.employeeId === scope.employeeId || s.createdBy === scope.userId);
  }
}
