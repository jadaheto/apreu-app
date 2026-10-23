import { Expense } from './expense.js';
import { ExpenseCategory } from './expense-category.js';
import { ReceiptNumber } from './receipt-number.js';

describe('ReceiptNumber', () => {
  it('composes {prefix}-{YYYY}-{NNNNNN}', () => {
    expect(ReceiptNumber.compose('rec', 2026, 42)).toBe('REC-2026-000042');
  });

  it('defaults and validates the prefix', () => {
    expect(ReceiptNumber.normalizePrefix(null)).toBe('REC');
    expect(() => ReceiptNumber.normalizePrefix('RE-C')).toThrow(
      expect.objectContaining({ code: 'INVALID_RECEIPT_PREFIX' }),
    );
  });

  it('fails when the yearly sequence is exhausted', () => {
    expect(() => ReceiptNumber.compose('REC', 2026, 1_000_000)).toThrow(
      expect.objectContaining({ code: 'RECEIPT_SEQUENCE_EXHAUSTED' }),
    );
  });
});

describe('Expense', () => {
  it('creates an expense with defaults', () => {
    const expense = Expense.create({
      categoryId: null,
      description: ' Papelería ',
      amount: 1500.5,
      date: '2026-03-10',
      createdBy: 1,
    });
    expect(expense).toMatchObject({ description: 'Papelería', paymentMethod: 'efectivo', vendor: null });
    expect(expense.amount.amount).toBe(1500.5);
  });

  it.each([
    [{ amount: 0 }, 'INVALID_EXPENSE_AMOUNT'],
    [{ description: '' }, 'REQUIRED_FIELD'],
    [{ date: '2026-02-30' }, 'INVALID_DATE'],
  ])('rejects %o', (override, code) => {
    expect(() =>
      Expense.create({
        categoryId: null,
        description: 'X',
        amount: 1,
        date: '2026-03-10',
        createdBy: null,
        ...override,
      }),
    ).toThrow(expect.objectContaining({ code }));
  });
});

describe('ExpenseCategory', () => {
  it('validates and renames', () => {
    const category = ExpenseCategory.create(' Servicios ');
    category.rename('Servicios públicos');
    expect(category.name).toBe('Servicios públicos');
    expect(() => category.rename('')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
  });
});
