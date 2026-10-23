import { ClosePeriodUseCase } from '../../application/close-period.use-case.js';
import { CreatePeriodUseCase } from '../../application/create-period.use-case.js';
import { GetCurrentPeriodUseCase } from '../../application/get-current-period.use-case.js';
import { ListPeriodsUseCase } from '../../application/list-periods.use-case.js';
import { ReopenPeriodUseCase } from '../../application/reopen-period.use-case.js';
import { ACCOUNTANT } from '../../testing/accounting-fixture.js';
import { buildController } from '../../testing/controller-harness.js';
import { PeriodsController } from './periods.controller.js';

describe('PeriodsController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(PeriodsController, [
      ListPeriodsUseCase,
      GetCurrentPeriodUseCase,
      CreatePeriodUseCase,
      ClosePeriodUseCase,
      ReopenPeriodUseCase,
    ]);
    await expect(controller.list()).resolves.toEqual({ ok: 'ListPeriodsUseCase' });
    await expect(controller.current()).resolves.toEqual({ ok: 'GetCurrentPeriodUseCase' });
    const dto = { name: 'Marzo', startDate: '2026-03-01', endDate: '2026-03-31' };
    await controller.create(dto);
    expect(mock(CreatePeriodUseCase).execute).toHaveBeenCalledWith(dto);
    await controller.close(2, ACCOUNTANT);
    expect(mock(ClosePeriodUseCase).execute).toHaveBeenCalledWith({ periodId: 2, actor: ACCOUNTANT });
    await controller.reopen(2, { reason: 'Ajuste' }, ACCOUNTANT);
    expect(mock(ReopenPeriodUseCase).execute).toHaveBeenCalledWith({
      periodId: 2,
      reason: 'Ajuste',
      actor: ACCOUNTANT,
    });
  });
});
