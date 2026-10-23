import type { AiContextPort } from '../domain/directory/ai-context.port.js';
import type {
  BillingChargesPort,
  ChargeNotice,
  PendingChargesFilter,
} from '../domain/directory/billing-charges.port.js';
import type { GroupDirectorPort } from '../domain/directory/group-director.port.js';
import type { ElectronicInvoiceData, InvoiceLookupPort } from '../domain/directory/invoice-lookup.port.js';
import type { PaymentConfirmationData, PaymentLookupPort } from '../domain/directory/payment-lookup.port.js';
import type { GuardianMobile, RecipientDirectoryPort } from '../domain/directory/recipient-directory.port.js';
import type { StudentContact, StudentContactsPort } from '../domain/directory/student-contacts.port.js';
import type { Recipient } from '../domain/email/recipient.js';

/** Configurable double of every read-only port over other contexts. */
export class FakeDirectory
  implements
    RecipientDirectoryPort,
    GroupDirectorPort,
    BillingChargesPort,
    PaymentLookupPort,
    InvoiceLookupPort,
    StudentContactsPort,
    AiContextPort
{
  guardians: (Recipient & { gradeId?: number; classroomId?: number })[] = [];
  employees: Recipient[] = [];
  mobiles: GuardianMobile[] = [];
  users: number[] = [];
  directors: { userId: number; classroomId: number }[] = [];
  charges: ChargeNotice[] = [];
  lastChargesFilter: PendingChargesFilter | null = null;
  payments: PaymentConfirmationData[] = [];
  invoices: ElectronicInvoiceData[] = [];
  students: StudentContact[] = [];
  periods = new Map<number, string>();
  activeStudents = 0;
  documents = new Map<number, string>();

  async guardianEmails(filter: { gradeId?: number; classroomId?: number }): Promise<Recipient[]> {
    return this.guardians
      .filter((g) => filter.gradeId === undefined || g.gradeId === filter.gradeId)
      .filter((g) => filter.classroomId === undefined || g.classroomId === filter.classroomId)
      .map(({ email, name }) => ({ email, name }));
  }
  async activeEmployeeEmails(): Promise<Recipient[]> {
    return this.employees;
  }
  async guardianMobiles(): Promise<GuardianMobile[]> {
    return this.mobiles;
  }
  async existingUserIds(userIds: readonly number[]): Promise<number[]> {
    return userIds.filter((id) => this.users.includes(id));
  }
  async isActiveDirector(userId: number, classroomId: number): Promise<boolean> {
    return this.directors.some((d) => d.userId === userId && d.classroomId === classroomId);
  }
  async pendingCharges(filter: PendingChargesFilter): Promise<ChargeNotice[]> {
    this.lastChargesFilter = filter;
    return this.charges.filter((c) => !filter.conceptId || c.conceptName === `concepto-${filter.conceptId}`);
  }
  async findForConfirmation(paymentId: number): Promise<PaymentConfirmationData | null> {
    return this.payments.find((p) => p.paymentId === paymentId) ?? null;
  }
  async findById(dianInvoiceId: number): Promise<ElectronicInvoiceData | null> {
    return this.invoices.find((i) => i.id === dianInvoiceId) ?? null;
  }
  async contacts(studentIds: readonly number[]): Promise<StudentContact[]> {
    return this.students.filter((s) => studentIds.includes(s.studentId));
  }
  async periodName(periodId: number): Promise<string | null> {
    return this.periods.get(periodId) ?? null;
  }
  async activeStudentCount(): Promise<number> {
    return this.activeStudents;
  }
  async documentNumberOf(userId: number): Promise<string | null> {
    return this.documents.get(userId) ?? null;
  }
}

export const charge = (overrides: Partial<ChargeNotice> = {}): ChargeNotice => ({
  chargeId: 1,
  studentId: 10,
  studentName: 'Ana Pérez',
  studentCode: 'A-001',
  conceptName: 'Pensión marzo',
  netAmount: 350000,
  dueDate: '2026-03-10',
  guardianName: 'Luis Pérez',
  guardianEmail: 'luis@mail.co',
  guardianMobile: '3001234567',
  ...overrides,
});
