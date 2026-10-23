import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { aCharge } from '../testing/fixtures.js';
import { Payment } from './payment.js';
import { PaymentAllocator } from './payment-allocator.js';

const register = (amount: number, studentId = 1) =>
  Payment.register({
    studentId,
    receiptNumber: 'REC-2026-000001',
    amount: Money.of(amount),
    method: 'efectivo',
    paidAt: new Date('2026-03-15T15:00:00Z'),
    cashierId: 9,
  });

const persisted = (charge: ReturnType<typeof aCharge>, id: number) => {
  charge.assignId(id);
  return charge;
};

describe('Payment', () => {
  it('validates amount and method', () => {
    expect(() => register(0)).toThrow(expect.objectContaining({ code: 'INVALID_PAYMENT_AMOUNT' }));
    expect(() =>
      Payment.register({
        studentId: 1,
        receiptNumber: 'R',
        amount: Money.of(1),
        method: 'bitcoin' as never,
        paidAt: new Date(),
        cashierId: null,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_OPTION' }));
  });

  it('never allocates more than its amount', () => {
    const payment = register(100);
    payment.allocate(1, Money.of(60));
    expect(payment.unappliedAmount.amount).toBe(40);
    expect(() => payment.allocate(2, Money.of(41))).toThrow(
      expect.objectContaining({ code: 'PAYMENT_OVERALLOCATION' }),
    );
  });

  it('reconciles only once and unreconciles', () => {
    const payment = register(100);
    payment.reconcile(' TRX-1 ', new Date(), 9);
    expect(payment.reconciliation?.bankRef).toBe('TRX-1');
    expect(() => payment.reconcile('TRX-2', new Date(), 9)).toThrow(expect.objectContaining({ code: 'CONFLICT' }));
    payment.unreconcile();
    expect(payment.reconciliation).toBeNull();
    expect(() => payment.unreconcile()).toThrow(expect.objectContaining({ code: 'PAYMENT_NOT_RECONCILED' }));
    expect(() => payment.reconcile('  ', new Date(), 9)).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
  });

  it('voids applied, non reconciled payments with a reason', () => {
    const payment = register(100);
    payment.allocate(1, Money.of(100));
    payment.reconcile('TRX', new Date(), 9);
    expect(() => payment.void('error', new Date(), 1)).toThrow(expect.objectContaining({ code: 'PAYMENT_RECONCILED' }));
    payment.unreconcile();
    expect(() => payment.void(' ', new Date(), 1)).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    payment.void('Estudiante equivocado', new Date(), 1);
    expect(payment.status).toBe('reversed');
    expect(payment.unappliedAmount.isZero()).toBe(true);
    expect(() => payment.void('otra vez', new Date(), 1)).toThrow(
      expect.objectContaining({ code: 'PAYMENT_NOT_APPLIED' }),
    );
  });

  it('assigns persisted ids to new applications', () => {
    const payment = register(100);
    payment.allocate(1, Money.of(10));
    payment.assignApplicationIds([77]);
    expect(payment.applications[0].id).toBe(77);
    expect(payment.pendingApplications).toHaveLength(0);
    expect(() => payment.assignApplicationIds([1])).toThrow();
  });
});

describe('PaymentAllocator', () => {
  it('pays the oldest charges first and keeps the excess as credit', () => {
    const march = persisted(aCharge({ net: 300, dueDate: '2026-03-31' }), 2);
    const february = persisted(aCharge({ net: 300, dueDate: '2026-02-28' }), 1);
    const payment = register(700);

    const allocations = PaymentAllocator.settle(payment, [march, february]);

    expect(allocations.map(({ charge, amount }) => [charge.id, amount.amount])).toEqual([
      [1, 300],
      [2, 300],
    ]);
    expect(february.status).toBe('paid');
    expect(march.status).toBe('paid');
    expect(payment.unappliedAmount.amount).toBe(100);
  });

  it('leaves the newest charge partial when money runs out', () => {
    const first = persisted(aCharge({ net: 300, dueDate: '2026-01-31' }), 1);
    const second = persisted(aCharge({ net: 300, dueDate: '2026-02-28' }), 2);
    PaymentAllocator.settle(register(400), [second, first]);
    expect(first.status).toBe('paid');
    expect(second.status).toBe('partial');
    expect(second.pendingAmount.amount).toBe(200);
  });

  it('skips charges of other students, cancelled or paid ones (bug B6)', () => {
    const foreign = persisted(aCharge({ studentId: 2 }), 1);
    const cancelled = persisted(aCharge(), 2);
    cancelled.cancel();
    const payment = register(100);
    expect(PaymentAllocator.settle(payment, [foreign, cancelled])).toEqual([]);
    expect(payment.unappliedAmount.amount).toBe(100);
  });
});
