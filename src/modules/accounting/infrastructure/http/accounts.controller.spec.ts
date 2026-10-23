import { CreateAccountUseCase } from '../../application/create-account.use-case.js';
import { DeleteAccountUseCase } from '../../application/delete-account.use-case.js';
import { ListAccountsUseCase } from '../../application/list-accounts.use-case.js';
import { SeedStandardPucUseCase } from '../../application/seed-standard-puc.use-case.js';
import { UpdateAccountUseCase } from '../../application/update-account.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { AccountsController } from './accounts.controller.js';

describe('AccountsController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(AccountsController, [
      ListAccountsUseCase,
      CreateAccountUseCase,
      UpdateAccountUseCase,
      DeleteAccountUseCase,
      SeedStandardPucUseCase,
    ]);
    await expect(controller.list({ tree: true })).resolves.toEqual({ ok: 'ListAccountsUseCase' });
    expect(mock(ListAccountsUseCase).execute).toHaveBeenCalledWith({ tree: true });
    const dto = { code: '110505', name: 'Caja', isTransactional: true };
    await controller.create(dto);
    expect(mock(CreateAccountUseCase).execute).toHaveBeenCalledWith(dto);
    await controller.update(4, { name: 'Caja general' });
    expect(mock(UpdateAccountUseCase).execute).toHaveBeenCalledWith({ id: 4, name: 'Caja general' });
    await expect(controller.remove(4)).resolves.toBeUndefined();
    expect(mock(DeleteAccountUseCase).execute).toHaveBeenCalledWith(4);
    await expect(controller.seed()).resolves.toEqual({ ok: 'SeedStandardPucUseCase' });
  });
});
