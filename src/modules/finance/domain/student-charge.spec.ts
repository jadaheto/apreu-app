import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { aCharge } from '../testing/fixtures.js';

describe('StudentCharge', () => {
  it('starts pending with the full net pending', () => {
    const charge = aCharge({ net: 100000 });
    expect(charge.status).toBe('pending');
    expect(charge.pendingAmount.amount).toBe(100000);
    expect(charge.isOpen).toBe(true);
  });

  it('moves to partial and paid as payments are applied', () => {
    const charge = aCharge({ net: 100000 });
    charge.applyPayment(Money.of(40000));
    expect(charge.status).toBe('partial');
    charge.applyPayment(Money.of(60000));
    expect(charge.status).toBe('paid');
    expect(charge.isOpen).toBe(false);
  });

  it('never accepts more than the pending balance', () => {
    const charge = aCharge({ net: 100000 });
    expect(() => charge.applyPayment(Money.of(100001))).toThrow(
      expect.objectContaining({ code: 'CHARGE_OVERPAYMENT' }),
    );
  });

  it('recalculates when a payment is reverted', () => {
    const charge = aCharge({ net: 100000 });
    charge.applyPayment(Money.of(100000));
    charge.revertPayment(Money.of(30000));
    expect(charge.status).toBe('partial');
    charge.revertPayment(Money.of(70000));
    expect(charge.status).toBe('pending');
    expect(charge.paidAmount.isZero()).toBe(true);
  });

  it('derives overdue from the due date', () => {
    const charge = aCharge({ dueDate: '2026-02-28' });
    expect(charge.isOverdue('2026-03-01')).toBe(true);
    expect(charge.isOverdue('2026-02-28')).toBe(false);
  });

  it('cancels only pending charges without payments', () => {
    const charge = aCharge();
    charge.cancel();
    expect(charge.status).toBe('cancelled');
    expect(() => charge.applyPayment(Money.of(1))).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_OPEN' }));

    const partial = aCharge();
    partial.applyPayment(Money.of(1000));
    expect(() => partial.cancel()).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_CANCELLABLE' }));
  });

  it('requires a valid description and due date', () => {
    expect(() => aCharge({ dueDate: '2026-02-30' })).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });
});
