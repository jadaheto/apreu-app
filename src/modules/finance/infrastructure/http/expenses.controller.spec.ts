import { CreateExpenseUseCase } from '../../application/create-expense.use-case.js';
import { ListExpenseCategoriesUseCase } from '../../application/list-expense-categories.use-case.js';
import { ListExpensesUseCase } from '../../application/list-expenses.use-case.js';
import { SaveExpenseCategoryUseCase } from '../../application/save-expense-category.use-case.js';
import { financeUser } from '../../testing/fixtures.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { ListExpensesQueryDto } from './dto/expense.dto.js';
import { ExpensesController } from './expenses.controller.js';

describe('ExpensesController', () => {
  it('delegates expenses and categories', async () => {
    const { controller, mock } = await controllerWithMocks(ExpensesController, [
      CreateExpenseUseCase,
      ListExpensesUseCase,
      ListExpenseCategoriesUseCase,
      SaveExpenseCategoryUseCase,
    ]);
    await controller.list(Object.assign(new ListExpensesQueryDto(), { categoryId: 2 }));
    await controller.create({ description: 'Luz', amount: 10 }, financeUser);
    await controller.categories();
    await controller.createCategory({ name: 'Servicios' });
    await controller.renameCategory(2, { name: 'Servicios públicos' });

    expect(mock(ListExpensesUseCase)).toHaveBeenCalledWith({
      criteria: expect.objectContaining({ categoryId: 2 }),
      page: { page: 1, limit: 20 },
    });
    expect(mock(CreateExpenseUseCase)).toHaveBeenCalledWith({ description: 'Luz', amount: 10, actor: financeUser });
    expect(mock(ListExpenseCategoriesUseCase)).toHaveBeenCalled();
    expect(mock(SaveExpenseCategoryUseCase)).toHaveBeenCalledWith({ name: 'Servicios' });
    expect(mock(SaveExpenseCategoryUseCase)).toHaveBeenCalledWith({ id: 2, name: 'Servicios públicos' });
  });
});
