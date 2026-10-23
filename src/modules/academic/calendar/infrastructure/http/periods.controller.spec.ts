import { buildController } from '../../../common/testing/controller-harness.js';
import { ClosePeriodUseCase } from '../../application/close-period.use-case.js';
import { CreatePeriodUseCase } from '../../application/create-period.use-case.js';
import { DeletePeriodUseCase } from '../../application/delete-period.use-case.js';
import { ListPeriodsUseCase } from '../../application/list-periods.use-case.js';
import { ReopenPeriodUseCase } from '../../application/reopen-period.use-case.js';
import { UpdatePeriodUseCase } from '../../application/update-period.use-case.js';
import { PeriodsController } from './periods.controller.js';

describe('PeriodsController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller: c, mocks } = await buildController(PeriodsController, [
      ListPeriodsUseCase,
      CreatePeriodUseCase,
      UpdatePeriodUseCase,
      DeletePeriodUseCase,
      ClosePeriodUseCase,
      ReopenPeriodUseCase,
    ]);
    const called = (useCase: Parameters<typeof mocks.get>[0]) => mocks.get(useCase)!.execute;
    const schedule = { name: 'P1', startDate: '2026-02-01', endDate: '2026-04-01' };

    await c.list({ year: 2026 });
    expect(called(ListPeriodsUseCase)).toHaveBeenCalledWith({ year: 2026 });
    await c.create(schedule);
    expect(called(CreatePeriodUseCase)).toHaveBeenCalledWith(schedule);
    await c.update(4, schedule);
    expect(called(UpdatePeriodUseCase)).toHaveBeenCalledWith({ periodId: 4, ...schedule });
    await c.remove(4);
    expect(called(DeletePeriodUseCase)).toHaveBeenCalledWith(4);
    await c.close(4);
    expect(called(ClosePeriodUseCase)).toHaveBeenCalledWith(4);
    await c.reopen(4);
    expect(called(ReopenPeriodUseCase)).toHaveBeenCalledWith(4);
  });
});
