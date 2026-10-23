import { DeletePostingRuleUseCase } from '../../application/delete-posting-rule.use-case.js';
import { ListPostingRulesUseCase } from '../../application/list-posting-rules.use-case.js';
import { SeedDefaultPostingRulesUseCase } from '../../application/seed-default-posting-rules.use-case.js';
import { SetPostingRuleUseCase } from '../../application/set-posting-rule.use-case.js';
import { ACCOUNTANT } from '../../testing/accounting-fixture.js';
import { buildController } from '../../testing/controller-harness.js';
import { PostingRulesController } from './posting-rules.controller.js';

describe('PostingRulesController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(PostingRulesController, [
      ListPostingRulesUseCase,
      SetPostingRuleUseCase,
      DeletePostingRuleUseCase,
      SeedDefaultPostingRulesUseCase,
    ]);
    await expect(controller.list()).resolves.toEqual({ ok: 'ListPostingRulesUseCase' });
    await controller.set('payroll.credit.net', { accountId: 9 }, ACCOUNTANT);
    expect(mock(SetPostingRuleUseCase).execute).toHaveBeenCalledWith({
      key: 'payroll.credit.net',
      accountId: 9,
      actor: ACCOUNTANT,
    });
    await controller.remove('payroll.credit.net');
    expect(mock(DeletePostingRuleUseCase).execute).toHaveBeenCalledWith('payroll.credit.net');
    await expect(controller.loadDefaults(ACCOUNTANT)).resolves.toEqual({ ok: 'SeedDefaultPostingRulesUseCase' });
    expect(mock(SeedDefaultPostingRulesUseCase).execute).toHaveBeenCalledWith(ACCOUNTANT);
  });
});
