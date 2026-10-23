import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { FixedClock } from '../../../shared/testing/fakes.js';
import { Payment } from '../domain/payment.js';
import { FakeStudentDirectory, FakeStudentLinks } from '../testing/fakes.js';
import { aCharge, aStudent, actorWith, financeUser } from '../testing/fixtures.js';
import { InMemoryPaymentRepository, InMemoryStudentChargeRepository } from '../testing/in-memory-repositories.js';
import { GetAccountStatementUseCase } from './get-account-statement.use-case.js';
import { ListMyStudentsUseCase } from './list-my-students.use-case.js';
import { ListStudentChargesUseCase } from './list-student-charges.use-case.js';
import { ListStudentPaymentsUseCase } from './list-student-payments.use-case.js';
import type { PaymentQueriesPort } from './ports/payment-queries.port.js';
import { SearchStudentsForBillingUseCase } from './search-students-for-billing.use-case.js';
import { StudentAccessPolicy } from './student-access.policy.js';

describe('student statement use cases', () => {
  const clock = new FixedClock(new Date('2026-03-15T15:00:00Z'));
  let students: FakeStudentDirectory;
  let charges: InMemoryStudentChargeRepository;
  let payments: InMemoryPaymentRepository;
  let links: FakeStudentLinks;
  let policy: StudentAccessPolicy;
  const paymentQueries = { listByStudent: vi.fn().mockResolvedValue([{ id: 1, receiptNumber: 'REC-2026-000001' }]) };

  beforeEach(async () => {
    students = new FakeStudentDirectory();
    students.add(aStudent({ id: 1, fullName: 'Zoe Ruiz' }));
    students.add(aStudent({ id: 2, fullName: 'Ana Ruiz' }));
    charges = new InMemoryStudentChargeRepository();
    payments = new InMemoryPaymentRepository();
    links = new FakeStudentLinks();
    policy = new StudentAccessPolicy(links);

    const overdue = aCharge({ net: 100000, dueDate: '2026-02-28' });
    const future = aCharge({ net: 50000, dueDate: '2026-03-31' });
    const cancelled = aCharge({ net: 70000, dueDate: '2026-01-31' });
    await charges.saveMany([overdue, future, cancelled]);
    cancelled.cancel();
    overdue.applyPayment(Money.of(30000));

    const payment = Payment.register({
      studentId: 1,
      receiptNumber: 'REC-2026-000001',
      amount: Money.of(40000),
      method: 'efectivo',
      paidAt: new Date('2026-03-01T15:00:00Z'),
      cashierId: 9,
    });
    payment.allocate(overdue.id as number, Money.of(30000));
    await payments.save(payment);
  });

  describe('GetAccountStatementUseCase', () => {
    const useCase = () =>
      new GetAccountStatementUseCase(
        students,
        charges,
        payments,
        paymentQueries as unknown as PaymentQueriesPort,
        clock,
        policy,
      );

    it('summarizes non-cancelled charges, overdue balance and credit (bugs B26/B27)', async () => {
      const statement = await useCase().execute({ studentId: 1, actor: financeUser });
      expect(statement.summary).toEqual({
        totalCharged: 150000,
        totalPaid: 30000,
        balance: 120000,
        overdueBalance: 70000,
        pendingCount: 2,
        paidCount: 0,
        creditBalance: 10000,
        netBalance: 110000,
      });
      expect(statement.charges).toHaveLength(3);
      expect(statement.charges[0]).toMatchObject({ status: 'cancelled', pendingAmount: 0 });
      expect(statement.payments).toHaveLength(1);
      expect(paymentQueries.listByStudent).toHaveBeenCalledWith(1, 100);
    });

    it('denies other students and unknown ids (bug S4)', async () => {
      await expect(useCase().execute({ studentId: 1, actor: actorWith(Role.TEACHER) })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(useCase().execute({ studentId: 404, actor: financeUser })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it('lists the charges of an own student (portal)', async () => {
    const parent = actorWith(Role.PARENT, 30);
    links.links.set(30, [1]);
    const view = await new ListStudentChargesUseCase(charges, clock, policy).execute({ studentId: 1, actor: parent });
    expect(view.summary).toMatchObject({ balance: 120000, pendingCount: 2 });
    expect(view.charges.find((charge) => charge.isOverdue)).toMatchObject({ pendingAmount: 70000 });
    await expect(
      new ListStudentChargesUseCase(charges, clock, policy).execute({ studentId: 2, actor: parent }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lists the payments of an own student (portal, bug S5)', async () => {
    const student = actorWith(Role.STUDENT, 40);
    links.links.set(40, [1]);
    const useCase = new ListStudentPaymentsUseCase(paymentQueries as unknown as PaymentQueriesPort, policy);
    await expect(useCase.execute({ studentId: 1, actor: student })).resolves.toHaveLength(1);
    expect(paymentQueries.listByStudent).toHaveBeenLastCalledWith(1, 50);
    await expect(useCase.execute({ studentId: 2, actor: student })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists the linked students of a guardian sorted by name', async () => {
    const parent = actorWith(Role.PARENT, 30);
    links.links.set(30, [1, 2, 99]);
    const mine = await new ListMyStudentsUseCase(students, policy).execute(parent);
    expect(mine.map((student) => student.fullName)).toEqual(['Ana Ruiz', 'Zoe Ruiz']);
    await expect(new ListMyStudentsUseCase(students, policy).execute(financeUser)).resolves.toEqual([]);
  });

  it('searches students only with at least two characters', async () => {
    const useCase = new SearchStudentsForBillingUseCase(students);
    await expect(useCase.execute({ term: 'r', limit: 10 })).resolves.toEqual([]);
    await expect(useCase.execute({ term: 'ruiz', limit: 1 })).resolves.toHaveLength(1);
  });
});
