import { ApplyCreditBalanceUseCase } from '../../application/apply-credit-balance.use-case.js';
import { GetAccountStatementUseCase } from '../../application/get-account-statement.use-case.js';
import { ListStudentChargesUseCase } from '../../application/list-student-charges.use-case.js';
import { ListStudentPaymentsUseCase } from '../../application/list-student-payments.use-case.js';
import { SearchStudentsForBillingUseCase } from '../../application/search-students-for-billing.use-case.js';
import { financeUser } from '../../testing/fixtures.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { StudentAccountsController } from './student-accounts.controller.js';

describe('StudentAccountsController', () => {
  it('delegates search, statement, charges, payments and credit application', async () => {
    const { controller, mock } = await controllerWithMocks(StudentAccountsController, [
      SearchStudentsForBillingUseCase,
      GetAccountStatementUseCase,
      ListStudentChargesUseCase,
      ListStudentPaymentsUseCase,
      ApplyCreditBalanceUseCase,
    ]);
    await controller.search({ q: 'ana', limit: 10 });
    await controller.statement(4, financeUser);
    await controller.charges(4, financeUser);
    await controller.payments(4, financeUser);
    await controller.applyCreditBalance(4);

    expect(mock(SearchStudentsForBillingUseCase)).toHaveBeenCalledWith({ term: 'ana', limit: 10 });
    expect(mock(GetAccountStatementUseCase)).toHaveBeenCalledWith({ studentId: 4, actor: financeUser });
    expect(mock(ListStudentChargesUseCase)).toHaveBeenCalledWith({ studentId: 4, actor: financeUser });
    expect(mock(ListStudentPaymentsUseCase)).toHaveBeenCalledWith({ studentId: 4, actor: financeUser });
    expect(mock(ApplyCreditBalanceUseCase)).toHaveBeenCalledWith({ studentId: 4 });
  });
});
