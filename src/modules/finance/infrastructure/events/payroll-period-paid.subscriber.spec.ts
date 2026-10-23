import { RecordingEventBus } from '../../../../shared/testing/fakes.js';
import type { RecordPayrollExpenseUseCase } from '../../application/record-payroll-expense.use-case.js';
import { PayrollPeriodPaidSubscriber } from './payroll-period-paid.subscriber.js';

describe('PayrollPeriodPaidSubscriber', () => {
  it('records the payroll expense when HR pays a period', async () => {
    const bus = new RecordingEventBus();
    const useCase = { execute: vi.fn().mockResolvedValue(null) };
    new PayrollPeriodPaidSubscriber(bus, useCase as unknown as RecordPayrollExpenseUseCase).onModuleInit();
    const payload = {
      periodId: 1,
      periodName: 'Marzo',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      grossTotal: 2,
      deductionsTotal: 1,
      netTotal: 1,
    };

    await bus.publish({ name: 'hr.payroll-period-paid', occurredAt: new Date(), payload });

    expect(useCase.execute).toHaveBeenCalledWith(payload);
  });
});
