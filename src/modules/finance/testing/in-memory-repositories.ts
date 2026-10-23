import { toOffset, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { BillingConcept } from '../domain/billing-concept.js';
import type { BillingConceptRepository } from '../domain/billing-concept.repository.js';
import type { BillingPeriod } from '../domain/billing-period.vo.js';
import type { Expense } from '../domain/expense.js';
import type { ExpenseCategory } from '../domain/expense-category.js';
import type { ExpenseCategoryRepository } from '../domain/expense-category.repository.js';
import type { ExpenseRepository, ExpenseSearchCriteria } from '../domain/expense.repository.js';
import type { Payment } from '../domain/payment.js';
import type { PaymentRepository } from '../domain/payment.repository.js';
import { byAge } from '../domain/payment-allocator.js';
import type { ReceiptSequencePort } from '../domain/receipt-sequence.port.js';
import type { StudentCharge } from '../domain/student-charge.js';
import type { StudentChargeRepository } from '../domain/student-charge.repository.js';
import { TuitionSchedule } from '../domain/tuition-schedule.js';
import type { TuitionScheduleRepository } from '../domain/tuition-schedule.repository.js';

export class InMemoryBillingConceptRepository implements BillingConceptRepository {
  readonly store = new InMemoryStore<BillingConcept>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((concept) => ids.includes(concept.id as number));
  }
  async list({ active }: { active?: boolean }) {
    return this.store.all().filter((concept) => active === undefined || concept.isActive === active);
  }
  async save(concept: BillingConcept) {
    this.store.save(concept);
  }
}

export class InMemoryTuitionScheduleRepository implements TuitionScheduleRepository {
  readonly schedules = new Map<number, TuitionSchedule>();

  async findByYear(year: number) {
    return this.schedules.get(year) ?? TuitionSchedule.restore(year, []);
  }
  async replace(schedule: TuitionSchedule) {
    this.schedules.set(schedule.academicYear, schedule);
  }
}

export class InMemoryStudentChargeRepository implements StudentChargeRepository {
  readonly store = new InMemoryStore<StudentCharge>();
  /** Options received by the locking reads, to assert that rows were locked. */
  readonly lockRequests: boolean[] = [];

  async findById(id: number, options?: { forUpdate?: boolean }) {
    this.lockRequests.push(Boolean(options?.forUpdate));
    return this.store.get(id);
  }
  async findByIds(ids: number[], options?: { forUpdate?: boolean }) {
    this.lockRequests.push(Boolean(options?.forUpdate));
    return this.store
      .all()
      .filter((charge) => ids.includes(charge.id as number))
      .sort(byAge);
  }
  async findByStudent(studentId: number) {
    return this.store
      .all()
      .filter((charge) => charge.studentId === studentId)
      .sort(byAge);
  }
  async findOpenByStudent(studentId: number, options?: { forUpdate?: boolean }) {
    this.lockRequests.push(Boolean(options?.forUpdate));
    return (await this.findByStudent(studentId)).filter((charge) => charge.isOpen);
  }
  async studentsAlreadyCharged(conceptId: number, period: BillingPeriod, studentIds: number[]) {
    return new Set(
      this.store
        .all()
        .filter(
          (charge) =>
            charge.conceptId === conceptId &&
            !charge.isCancelled &&
            charge.period.equals(period) &&
            studentIds.includes(charge.studentId),
        )
        .map((charge) => charge.studentId),
    );
  }
  async save(charge: StudentCharge) {
    this.store.save(charge);
  }
  async saveMany(charges: StudentCharge[]) {
    charges.forEach((charge) => this.store.save(charge));
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly store = new InMemoryStore<Payment>();
  private applicationSequence = 0;

  async findById(id: number) {
    return this.store.get(id);
  }
  async findWithCredit(studentId: number) {
    return this.store
      .all()
      .filter((payment) => payment.studentId === studentId && !payment.unappliedAmount.isZero())
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || (a.id as number) - (b.id as number));
  }
  async isBankRefTaken(bankRef: string, exceptPaymentId: number) {
    return this.store
      .all()
      .some((payment) => payment.id !== exceptPaymentId && payment.reconciliation?.bankRef === bankRef);
  }
  async save(payment: Payment) {
    this.store.save(payment);
    const pending = payment.pendingApplications;
    payment.assignApplicationIds(pending.map(() => ++this.applicationSequence));
  }
}

export class InMemoryExpenseRepository implements ExpenseRepository {
  readonly store = new InMemoryStore<Expense>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async existsByReceiptNo(receiptNo: string) {
    return this.store.all().some((expense) => expense.receiptNo === receiptNo);
  }
  async search(criteria: ExpenseSearchCriteria, page: PageRequest): Promise<Paginated<Expense>> {
    const matches = this.store
      .all()
      .filter((expense) => !criteria.from || expense.date >= criteria.from)
      .filter((expense) => !criteria.to || expense.date <= criteria.to)
      .filter((expense) => !criteria.categoryId || expense.categoryId === criteria.categoryId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }
  async save(expense: Expense) {
    this.store.save(expense);
  }
}

export class InMemoryExpenseCategoryRepository implements ExpenseCategoryRepository {
  readonly store = new InMemoryStore<ExpenseCategory>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByName(name: string) {
    return this.store.all().find((category) => category.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
  }
  async list() {
    return this.store.all().sort((a, b) => a.name.localeCompare(b.name));
  }
  async save(category: ExpenseCategory) {
    this.store.save(category);
  }
}

/** Counter per (prefix, year) that records whether it was called inside a transaction. */
export class InMemoryReceiptSequence implements ReceiptSequencePort {
  readonly counters = new Map<string, number>();

  async next(prefix: string, year: number) {
    const key = `${prefix}-${year}`;
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
}
