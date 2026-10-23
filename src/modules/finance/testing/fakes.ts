import type { FinanceSettings, FinanceSettingsPort } from '../domain/finance-settings.port.js';
import type { GradeCatalogPort } from '../domain/grade-catalog.port.js';
import { PAYMENT_METHODS } from '../domain/payment-method.js';
import type {
  DisbursementLine,
  PayrollDisbursementSourcePort,
  PayrollPeriodInfo,
} from '../domain/payroll-disbursement-source.port.js';
import type { BillingStudent, StudentDirectoryPort } from '../domain/student-directory.port.js';
import type { PortalUser, StudentLinksPort } from '../domain/student-links.port.js';

export class FakeStudentDirectory implements StudentDirectoryPort {
  readonly students: BillingStudent[] = [];

  add(student: BillingStudent): BillingStudent {
    this.students.push(student);
    return student;
  }
  async findById(id: number) {
    return this.students.find((student) => student.id === id) ?? null;
  }
  async findActive({ gradeId }: { gradeId?: number }) {
    return this.students.filter((student) => student.status === 'active' && (!gradeId || student.gradeId === gradeId));
  }
  async search(term: string, limit: number) {
    return this.students
      .filter((student) => student.fullName.toLowerCase().includes(term.toLowerCase()) || student.code === term)
      .slice(0, limit);
  }
}

export class FakeGradeCatalog implements GradeCatalogPort {
  constructor(private readonly ids: number[] = [1, 2, 3]) {}
  async existingIds(ids: number[]) {
    return ids.filter((id) => this.ids.includes(id));
  }
}

/** Links by user id: `links.set(userId, [studentIds])`. */
export class FakeStudentLinks implements StudentLinksPort {
  readonly links = new Map<number, number[]>();
  async studentIdsLinkedTo(user: PortalUser) {
    return this.links.get(user.userId) ?? [];
  }
}

export class FakeFinanceSettings implements FinanceSettingsPort {
  constructor(public settings: Partial<FinanceSettings> = {}) {}
  async load(): Promise<FinanceSettings> {
    return {
      academicYear: 2026,
      receiptPrefix: 'REC',
      enabledPaymentMethods: [...PAYMENT_METHODS],
      schoolNit: '900123456',
      schoolName: 'Colegio Prueba',
      ...this.settings,
    };
  }
}

export class FakePayrollSource implements PayrollDisbursementSourcePort {
  constructor(
    public period: PayrollPeriodInfo | null = { id: 7, name: 'Marzo 2026', status: 'closed' },
    public lines: DisbursementLine[] = [],
  ) {}
  async findPeriod(id: number) {
    return this.period && this.period.id === id ? this.period : null;
  }
  async linesOf() {
    return this.lines;
  }
}
