import type { Role } from '../../../shared/domain/role.js';
import type { FileStoragePort } from '../application/ports/file-storage.port.js';
import type { QrSignerPort } from '../application/ports/qr-signer.port.js';
import type { SecretGeneratorPort } from '../application/ports/secret-generator.port.js';
import type { NewUserAccount, UserAccount, UserAccountPort } from '../application/ports/user-account.port.js';
import type { AcademicPerformance, AcademicPerformancePort } from '../domain/academic-performance.port.js';
import type { CertificateConceptCatalogPort } from '../domain/certificate-concept-catalog.port.js';
import type { ClassroomDirectoryPort, ClassroomInfo } from '../domain/classroom-directory.port.js';
import type { InstitutionProfile, InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import type { StudentCodeSequencePort } from '../domain/student-code-sequence.port.js';
import type {
  FinancialSummary,
  PaymentRecord,
  PendingCharge,
  StudentFinancePort,
} from '../domain/student-finance.port.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';

export class InMemoryCodeSequence implements StudentCodeSequencePort {
  readonly counters = new Map<number, number>();
  async next(year: number) {
    const value = (this.counters.get(year) ?? 0) + 1;
    this.counters.set(year, value);
    return value;
  }
}

export class FakeClassroomDirectory implements ClassroomDirectoryPort {
  constructor(public classrooms: ClassroomInfo[] = []) {}
  async findById(id: number) {
    return this.classrooms.find((c) => c.id === id) ?? null;
  }
  async findByIds(ids: number[]) {
    return this.classrooms.filter((c) => ids.includes(c.id));
  }
}

export const defaultInstitution = (): InstitutionProfile => ({
  schoolName: 'Colegio Demo',
  nit: '900.123.456-7',
  city: 'Bogotá',
  rectorName: 'Ana Rectora',
  academicYear: 2026,
  logo: 'uploads/logo.png',
  logoSize: 60,
  signature: null,
});

export class FakeInstitutionSettings implements InstitutionSettingsPort {
  constructor(public profile: InstitutionProfile = defaultInstitution()) {}
  async load() {
    return { ...this.profile };
  }
}

export class FakeStudentFinance implements StudentFinancePort {
  summaryResult: FinancialSummary = {
    charged: 0,
    paid: 0,
    balance: 0,
    overdueCount: 0,
  };
  pending: PendingCharge[] = [];
  paymentList: PaymentRecord[] = [];
  readonly calls: { method: string; args: unknown[] }[] = [];

  async summary(studentId: number, today: string) {
    this.calls.push({ method: 'summary', args: [studentId, today] });
    return this.summaryResult;
  }
  async pendingCharges(studentId: number, today: string) {
    this.calls.push({ method: 'pendingCharges', args: [studentId, today] });
    return this.pending;
  }
  async payments(studentId: number, limit: number) {
    this.calls.push({ method: 'payments', args: [studentId, limit] });
    return this.paymentList.slice(0, limit);
  }
}

export class FakeAcademicPerformance implements AcademicPerformancePort {
  result: AcademicPerformance = { average: null, recordCount: 0 };
  async forYear() {
    return this.result;
  }
}

export class FakeCertificateConceptCatalog implements CertificateConceptCatalogPort {
  constructor(public certificateIds: number[] = []) {}
  async certificateConceptIds(conceptIds: number[]) {
    return conceptIds.filter((id) => this.certificateIds.includes(id));
  }
}

export class InMemoryUserAccounts implements UserAccountPort {
  readonly accounts: (UserAccount & { name: string; passwordHash: string })[] = [];

  add(email: string, role: Role, name = 'Usuario', passwordHash = 'x'): UserAccount {
    const account = {
      id: this.accounts.length + 1,
      email,
      role,
      isActive: true,
      name,
      passwordHash,
    };
    this.accounts.push(account);
    return account;
  }
  async findById(id: number) {
    return this.accounts.find((a) => a.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.accounts.find((a) => a.email === email.toLowerCase()) ?? null;
  }
  async create(account: NewUserAccount) {
    return this.add(account.email, account.role, account.name, account.passwordHash).id;
  }
  async changePassword(userId: number, passwordHash: string) {
    const account = this.accounts.find((a) => a.id === userId);
    if (account) account.passwordHash = passwordHash;
  }
  async displayNames(ids: number[]) {
    return new Map(this.accounts.filter((a) => ids.includes(a.id)).map((a) => [a.id, a.name]));
  }
}

export class SequentialSecretGenerator implements SecretGeneratorPort {
  private passwords = 0;
  private codes = 0;
  temporaryPassword() {
    return `Temporal${++this.passwords}x`;
  }
  verificationCode() {
    return `verif-code-${++this.codes}`;
  }
}

/** Deterministic signer for tests: the signature encodes the message. */
export class FakeQrSigner implements QrSignerPort {
  sign(message: string) {
    return `sig_${Buffer.from(message).toString('base64url')}`.slice(0, 120);
  }
  verify(message: string, signature: string) {
    return this.sign(message) === signature;
  }
}

export class InMemoryFileStorage implements FileStoragePort {
  readonly files = new Map<string, Uint8Array>();
  async save(directory: string, fileName: string, content: Uint8Array) {
    const path = `${directory}/${fileName}`;
    this.files.set(path, content);
    return path;
  }
  async read(path: string) {
    const file = this.files.get(path);
    if (!file) throw new NotFoundError('Archivo', path);
    return file;
  }
  async remove(path: string) {
    this.files.delete(path);
  }
}
