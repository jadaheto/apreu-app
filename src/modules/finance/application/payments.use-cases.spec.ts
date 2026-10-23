import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { FakeFinanceSettings, FakeStudentDirectory, FakeStudentLinks } from '../testing/fakes.js';
import { aCharge, aConcept, aStudent, actorWith, financeUser } from '../testing/fixtures.js';
import {
  InMemoryBillingConceptRepository,
  InMemoryPaymentRepository,
  InMemoryReceiptSequence,
  InMemoryStudentChargeRepository,
} from '../testing/in-memory-repositories.js';
import { ApplyCreditBalanceUseCase } from './apply-credit-balance.use-case.js';
import type { PaymentQueriesPort, ReceiptData } from './ports/payment-queries.port.js';
import { GetReceiptUseCase } from './get-receipt.use-case.js';
import { ListPaymentsUseCase } from './list-payments.use-case.js';
import { ReconcilePaymentUseCase } from './reconcile-payment.use-case.js';
import { RegisterPaymentUseCase, type RegisterPaymentInput } from './register-payment.use-case.js';
import { StudentAccessPolicy } from './student-access.policy.js';
import { UnreconcilePaymentUseCase } from './unreconcile-payment.use-case.js';
import { VoidPaymentUseCase } from './void-payment.use-case.js';

describe('payment use cases', () => {
  let payments: InMemoryPaymentRepository;
  let charges: InMemoryStudentChargeRepository;
  let concepts: InMemoryBillingConceptRepository;
  let students: FakeStudentDirectory;
  let receipts: InMemoryReceiptSequence;
  let settings: FakeFinanceSettings;
  let uow: FakeUnitOfWork;
  let events: RecordingEventBus;
  let clock: FixedClock;
  let register: RegisterPaymentUseCase;

  beforeEach(async () => {
    payments = new InMemoryPaymentRepository();
    charges = new InMemoryStudentChargeRepository();
    concepts = new InMemoryBillingConceptRepository();
    await concepts.save(aConcept({ name: 'Pensión' }));
    await concepts.save(aConcept({ name: 'Certificado', category: 'certificado', amount: 25000 }));
    students = new FakeStudentDirectory();
    students.add(aStudent({ id: 1 }));
    students.add(aStudent({ id: 2 }));
    receipts = new InMemoryReceiptSequence();
    settings = new FakeFinanceSettings();
    uow = new FakeUnitOfWork();
    events = new RecordingEventBus();
    clock = new FixedClock(new Date('2026-03-15T15:00:00Z'));
    register = new RegisterPaymentUseCase(
      payments,
      charges,
      concepts,
      students,
      receipts,
      settings,
      uow,
      events,
      clock,
    );
    await charges.save(aCharge({ net: 300000, dueDate: '2026-02-28' }));
    await charges.save(aCharge({ net: 25000, dueDate: '2026-03-31', conceptId: 2 }));
    await charges.save(aCharge({ net: 300000, dueDate: '2026-01-31' }));
    await charges.save(aCharge({ net: 999, studentId: 2 }));
  });

  const pay = (input: Partial<RegisterPaymentInput> = {}) =>
    register.execute({ studentId: 1, amount: 625000, method: 'efectivo', actor: financeUser, ...input });

  describe('RegisterPaymentUseCase', () => {
    it('applies FIFO, numbers the receipt and publishes the event', async () => {
      const view = await pay();

      expect(view).toMatchObject({
        paymentId: 1,
        receiptNumber: 'REC-2026-000001',
        appliedAmount: 625000,
        unappliedAmount: 0,
      });
      expect(view.applications.map((a) => a.chargeId)).toEqual([3, 1, 2]);
      expect(view.applications.every((a) => a.chargeStatus === 'paid')).toBe(true);
      expect(uow.transactions).toBe(1);
      expect(charges.lockRequests).toContain(true);
      expect(events.published).toEqual([
        expect.objectContaining({
          name: 'finance.payment-registered',
          payload: expect.objectContaining({
            paymentId: 1,
            receiptNumber: 'REC-2026-000001',
            studentId: 1,
            totalAmount: 625000,
            method: 'efectivo',
            paidAt: '2026-03-15T15:00:00.000Z',
            appliedCharges: expect.arrayContaining([
              {
                studentChargeId: 2,
                conceptId: 2,
                conceptName: 'Certificado',
                conceptCategory: 'certificado',
                amount: 25000,
              },
            ]),
          }),
        }),
      ]);
    });

    it('keeps the excess as explicit credit balance (bug B4)', async () => {
      const view = await pay({ amount: 700000 });
      expect(view).toMatchObject({ appliedAmount: 625000, unappliedAmount: 75000, creditBalance: 75000 });
    });

    it('only pays the selected charges, oldest first, leaving partial balances', async () => {
      const view = await pay({ amount: 400000, chargeIds: [1, 3] });
      expect(view.applications.map((a) => [a.chargeId, a.amount, a.chargeStatus])).toEqual([
        [3, 300000, 'paid'],
        [1, 100000, 'partial'],
      ]);
    });

    it('rejects charges that are not payable for the student (bug B6)', async () => {
      await expect(pay({ chargeIds: [4] })).rejects.toMatchObject({
        code: 'CHARGE_NOT_PAYABLE',
        details: { chargeIds: [4] },
      });
    });

    it('validates method, date and student', async () => {
      settings.settings = { enabledPaymentMethods: ['efectivo'] };
      await expect(pay({ method: 'nequi' })).rejects.toMatchObject({ code: 'PAYMENT_METHOD_NOT_ENABLED' });
      await expect(pay({ method: 'bitcoin' })).rejects.toMatchObject({ code: 'PAYMENT_METHOD_NOT_ENABLED' });
      await expect(pay({ paymentDate: '2026-03-16' })).rejects.toMatchObject({ code: 'PAYMENT_DATE_IN_FUTURE' });
      await expect(pay({ studentId: 404 })).rejects.toBeInstanceOf(NotFoundError);
      expect(uow.transactions).toBe(0);
    });

    it('uses the year of the payment date for the receipt (bug B3)', async () => {
      const view = await pay({ amount: 1000, paymentDate: '2025-12-30' });
      expect(view.receiptNumber).toBe('REC-2025-000001');
      expect(view.paidAt.toISOString()).toBe('2025-12-30T05:00:00.000Z');
      expect((await pay({ amount: 1000 })).receiptNumber).toBe('REC-2026-000001');
    });
  });

  describe('VoidPaymentUseCase', () => {
    it('reverses the payment, recalculates charges and publishes the event', async () => {
      await pay({ amount: 400000 });
      const view = await new VoidPaymentUseCase(payments, charges, uow, events, clock).execute({
        paymentId: 1,
        reason: 'Error de digitación',
        actor: actorWith(Role.ADMIN),
      });
      expect(view).toMatchObject({ status: 'reversed', revertedCharges: [3, 1] });
      expect(charges.store.get(3)?.status).toBe('pending');
      expect(charges.store.get(1)?.paidAmount.isZero()).toBe(true);
      expect(payments.store.get(1)?.voiding).toMatchObject({ reason: 'Error de digitación', voidedBy: 1 });
      expect(events.published.at(-1)).toMatchObject({
        name: 'finance.payment-voided',
        payload: { paymentId: 1, receiptNumber: 'REC-2026-000001', reason: 'Error de digitación' },
      });
    });

    it('fails for unknown payments', async () => {
      await expect(
        new VoidPaymentUseCase(payments, charges, uow, events, clock).execute({
          paymentId: 5,
          reason: 'x',
          actor: financeUser,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ApplyCreditBalanceUseCase', () => {
    const apply = () => new ApplyCreditBalanceUseCase(payments, charges, students, uow, events, clock);

    it('applies previous credit to new charges and publishes credit-applied', async () => {
      await pay({ amount: 700000 });
      await charges.save(aCharge({ net: 50000, dueDate: '2026-04-30' }));

      const view = await apply().execute({ studentId: 1 });

      expect(view).toMatchObject({ appliedAmount: 50000, remainingCredit: 25000 });
      expect(view.applications).toEqual([
        { paymentId: 1, receiptNumber: 'REC-2026-000001', studentChargeId: 5, conceptId: 1, amount: 50000 },
      ]);
      expect(charges.store.get(5)?.status).toBe('paid');
      expect(events.published.at(-1)?.name).toBe('finance.credit-applied');
    });

    it('does nothing without credit', async () => {
      const view = await apply().execute({ studentId: 1 });
      expect(view).toMatchObject({ appliedAmount: 0, remainingCredit: 0, applications: [] });
      expect(events.published).toHaveLength(0);
      await expect(apply().execute({ studentId: 404 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('reconciliation', () => {
    beforeEach(async () => {
      await pay({ amount: 1000 });
      await pay({ amount: 1000 });
    });

    it('reconciles with a unique bank reference and unreconciles', async () => {
      const reconcile = new ReconcilePaymentUseCase(payments, uow, clock);
      await expect(reconcile.execute({ paymentId: 1, bankRef: 'TRX-1', actor: financeUser })).resolves.toMatchObject({
        reconciled: true,
        bankRef: 'TRX-1',
      });
      await expect(reconcile.execute({ paymentId: 2, bankRef: 'TRX-1', actor: financeUser })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await expect(new UnreconcilePaymentUseCase(payments, uow).execute({ paymentId: 1 })).resolves.toMatchObject({
        reconciled: false,
      });
      expect(payments.store.get(1)?.reconciliation).toBeNull();
    });

    it('fails for unknown payments (bug B28)', async () => {
      await expect(
        new ReconcilePaymentUseCase(payments, uow, clock).execute({ paymentId: 9, bankRef: 'X', actor: financeUser }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(new UnreconcilePaymentUseCase(payments, uow).execute({ paymentId: 9 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});

describe('GetReceiptUseCase', () => {
  const receipt: ReceiptData = {
    paymentId: 1,
    receiptNumber: 'REC-2026-000001',
    studentId: 7,
    studentName: 'Ana',
    studentCode: 'AL1',
    documentNumber: '1',
    amount: 1000,
    method: 'nequi',
    paidAt: new Date(),
    status: 'applied',
    reference: null,
    notes: null,
    cashierName: 'Caja',
    voidReason: null,
    lines: [{ chargeId: 1, conceptName: 'Pensión', description: 'Pensión', amount: 800, chargePending: 0 }],
  };
  const queries = { findReceipt: vi.fn() } as unknown as PaymentQueriesPort & { findReceipt: ReturnType<typeof vi.fn> };
  const links = new FakeStudentLinks();
  const useCase = new GetReceiptUseCase(queries, new FakeFinanceSettings(), new StudentAccessPolicy(links));

  it('adds school data and the unapplied remainder', async () => {
    queries.findReceipt.mockResolvedValue(receipt);
    await expect(useCase.execute({ receiptNumber: 'REC-2026-000001', actor: financeUser })).resolves.toMatchObject({
      schoolName: 'Colegio Prueba',
      methodLabel: 'Nequi',
      appliedAmount: 800,
      unappliedAmount: 200,
    });
  });

  it('protects receipts of other students and unknown numbers', async () => {
    queries.findReceipt.mockResolvedValue(receipt);
    await expect(useCase.execute({ receiptNumber: 'x', actor: actorWith(Role.STUDENT, 3) })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    links.links.set(3, [7]);
    await expect(useCase.execute({ receiptNumber: 'x', actor: actorWith(Role.STUDENT, 3) })).resolves.toBeDefined();
    queries.findReceipt.mockResolvedValue(null);
    await expect(useCase.execute({ receiptNumber: 'x', actor: financeUser })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListPaymentsUseCase', () => {
  it('validates dates and delegates', async () => {
    const queries = { search: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }) };
    const useCase = new ListPaymentsUseCase(queries as unknown as PaymentQueriesPort);
    await useCase.execute({ criteria: { from: '2026-03-01', to: '2026-03-31' }, page: { page: 1, limit: 20 } });
    expect(queries.search).toHaveBeenCalledWith({ from: '2026-03-01', to: '2026-03-31' }, { page: 1, limit: 20 });
    await expect(
      useCase.execute({ criteria: { from: '2026-02-30' }, page: { page: 1, limit: 20 } }),
    ).rejects.toMatchObject({
      code: 'INVALID_DATE',
    });
  });
});
