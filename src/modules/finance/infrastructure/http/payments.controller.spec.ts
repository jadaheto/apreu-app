import { ListPaymentsUseCase } from '../../application/list-payments.use-case.js';
import { ReconcilePaymentUseCase } from '../../application/reconcile-payment.use-case.js';
import { RegisterPaymentUseCase } from '../../application/register-payment.use-case.js';
import { UnreconcilePaymentUseCase } from '../../application/unreconcile-payment.use-case.js';
import { VoidPaymentUseCase } from '../../application/void-payment.use-case.js';
import { financeUser } from '../../testing/fixtures.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { ListPaymentsQueryDto } from './dto/payment.dto.js';
import { PaymentsController } from './payments.controller.js';

describe('PaymentsController', () => {
  it('delegates cashier, voiding and reconciliation', async () => {
    const { controller, mock } = await controllerWithMocks(PaymentsController, [
      RegisterPaymentUseCase,
      ListPaymentsUseCase,
      VoidPaymentUseCase,
      ReconcilePaymentUseCase,
      UnreconcilePaymentUseCase,
    ]);
    const dto = { studentId: 1, amount: 100, method: 'efectivo' as const, chargeIds: [2] };
    await controller.register(dto, financeUser);
    await controller.list(Object.assign(new ListPaymentsQueryDto(), { from: '2026-03-01' }));
    await controller.void(5, { reason: 'Error' }, financeUser);
    await controller.reconcile(5, { bankRef: 'TRX' }, financeUser);
    await controller.unreconcile(5);

    expect(mock(RegisterPaymentUseCase)).toHaveBeenCalledWith({ ...dto, actor: financeUser });
    expect(mock(ListPaymentsUseCase)).toHaveBeenCalledWith({
      criteria: expect.objectContaining({ from: '2026-03-01' }),
      page: { page: 1, limit: 20 },
    });
    expect(mock(VoidPaymentUseCase)).toHaveBeenCalledWith({ paymentId: 5, reason: 'Error', actor: financeUser });
    expect(mock(ReconcilePaymentUseCase)).toHaveBeenCalledWith({ paymentId: 5, bankRef: 'TRX', actor: financeUser });
    expect(mock(UnreconcilePaymentUseCase)).toHaveBeenCalledWith({ paymentId: 5 });
  });
});
