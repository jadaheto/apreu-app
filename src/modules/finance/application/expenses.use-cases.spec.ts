import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { ExpenseCategory } from '../domain/expense-category.js';
import { financeUser } from '../testing/fixtures.js';
import { InMemoryExpenseCategoryRepository, InMemoryExpenseRepository } from '../testing/in-memory-repositories.js';
import { CreateExpenseUseCase } from './create-expense.use-case.js';
import { ListExpenseCategoriesUseCase } from './list-expense-categories.use-case.js';
import { ListExpensesUseCase } from './list-expenses.use-case.js';
import { RecordPayrollExpenseUseCase } from './record-payroll-expense.use-case.js';
import { SaveExpenseCategoryUseCase } from './save-expense-category.use-case.js';

describe('expense use cases', () => {
  const clock = new FixedClock(new Date('2026-03-15T15:00:00Z'));
  let expenses: InMemoryExpenseRepository;
  let categories: InMemoryExpenseCategoryRepository;
  let events: RecordingEventBus;

  beforeEach(async () => {
    expenses = new InMemoryExpenseRepository();
    categories = new InMemoryExpenseCategoryRepository();
    events = new RecordingEventBus();
    await categories.save(ExpenseCategory.create('Servicios'));
  });

  it('creates an expense and publishes expense-registered', async () => {
    const view = await new CreateExpenseUseCase(expenses, categories, events, clock).execute({
      categoryId: 1,
      description: 'Energía',
      amount: 450000,
      actor: financeUser,
    });
    expect(view).toMatchObject({ id: 1, categoryName: 'Servicios', date: '2026-03-15', amount: 450000 });
    expect(events.published[0]).toMatchObject({
      name: 'finance.expense-registered',
      payload: {
        expenseId: 1,
        categoryId: 1,
        description: 'Energía',
        amount: 450000,
        date: '2026-03-15',
        source: 'manual',
      },
    });
  });

  it('rejects unknown categories', async () => {
    await expect(
      new CreateExpenseUseCase(expenses, categories, events, clock).execute({
        categoryId: 9,
        description: 'x',
        amount: 1,
        actor: financeUser,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists expenses with category names and validates dates', async () => {
    await new CreateExpenseUseCase(expenses, categories, events, clock).execute({
      description: 'Sin categoría',
      amount: 1,
      actor: financeUser,
    });
    const page = await new ListExpensesUseCase(expenses, categories).execute({
      criteria: { from: '2026-03-01' },
      page: { page: 1, limit: 10 },
    });
    expect(page.items).toEqual([expect.objectContaining({ description: 'Sin categoría', categoryName: null })]);
    await expect(
      new ListExpensesUseCase(expenses, categories).execute({
        criteria: { to: '2026-02-30' },
        page: { page: 1, limit: 10 },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE' });
  });

  it('creates and renames categories with unique names', async () => {
    const save = new SaveExpenseCategoryUseCase(categories);
    await expect(save.execute({ name: 'Nómina' })).resolves.toEqual({ id: 2, name: 'Nómina' });
    await expect(save.execute({ name: 'servicios' })).rejects.toBeInstanceOf(ConflictError);
    await expect(save.execute({ id: 1, name: 'Servicios públicos' })).resolves.toEqual({
      id: 1,
      name: 'Servicios públicos',
    });
    await expect(save.execute({ id: 1, name: 'servicios PÚBLICOS' })).resolves.toMatchObject({ id: 1 });
    await expect(save.execute({ id: 7, name: 'Otra' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(new ListExpenseCategoriesUseCase(categories).execute()).resolves.toHaveLength(2);
  });

  describe('RecordPayrollExpenseUseCase', () => {
    const period = {
      periodId: 4,
      periodName: 'Marzo 2026',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      grossTotal: 10_000_000,
      deductionsTotal: 800_000,
      netTotal: 9_200_000,
    };

    it('records the payroll expense once per period and publishes the event', async () => {
      const useCase = new RecordPayrollExpenseUseCase(expenses, categories, new FakeUnitOfWork(), events, clock);
      const payload = await useCase.execute(period);
      expect(payload).toMatchObject({
        amount: 9_200_000,
        source: 'payroll',
        description: 'Liquidación Marzo 2026',
        date: '2026-03-15',
      });
      expect(await categories.findByName('Pago de Nómina y SS')).not.toBeNull();
      expect(expenses.store.get(1)).toMatchObject({
        vendor: 'Empleados',
        paymentMethod: 'transferencia',
        receiptNo: 'NOMINA-4',
      });

      await expect(useCase.execute(period)).resolves.toBeNull();
      expect(expenses.store.all()).toHaveLength(1);
      expect(events.published.filter((event) => event.name === 'finance.expense-registered')).toHaveLength(1);
    });

    it('ignores periods without net pay', async () => {
      const useCase = new RecordPayrollExpenseUseCase(expenses, categories, new FakeUnitOfWork(), events, clock);
      await expect(useCase.execute({ ...period, netTotal: 0 })).resolves.toBeNull();
    });
  });
});
