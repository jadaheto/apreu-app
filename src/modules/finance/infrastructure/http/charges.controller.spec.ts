import { CancelChargeUseCase } from '../../application/cancel-charge.use-case.js';
import { CreateIndividualChargeUseCase } from '../../application/create-individual-charge.use-case.js';
import { GenerateChargeBatchUseCase } from '../../application/generate-charge-batch.use-case.js';
import { GetChargeDocumentUseCase } from '../../application/get-charge-document.use-case.js';
import { GetChargesSummaryUseCase } from '../../application/get-charges-summary.use-case.js';
import { ListChargesUseCase } from '../../application/list-charges.use-case.js';
import { PreviewChargeBatchUseCase } from '../../application/preview-charge-batch.use-case.js';
import { financeUser } from '../../testing/fixtures.js';
import { ChargesController } from './charges.controller.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { ListChargesQueryDto } from './dto/charge.dto.js';

describe('ChargesController', () => {
  it('passes the actor as creator and maps queries', async () => {
    const { controller, mock } = await controllerWithMocks(ChargesController, [
      PreviewChargeBatchUseCase,
      GenerateChargeBatchUseCase,
      CreateIndividualChargeUseCase,
      CancelChargeUseCase,
      ListChargesUseCase,
      GetChargesSummaryUseCase,
      GetChargeDocumentUseCase,
    ]);
    const batch = { conceptId: 1, period: '2026-03' };
    await controller.preview(batch, financeUser);
    await controller.generate(batch, financeUser);
    await controller.create({ ...batch, studentId: 4 }, financeUser);
    const query = Object.assign(new ListChargesQueryDto(), { status: 'pending', page: 2, limit: 5 });
    await controller.list(query);
    await controller.summary({ limit: 10 });
    await controller.cancel(8);
    await controller.document(8, financeUser);

    expect(mock(PreviewChargeBatchUseCase)).toHaveBeenCalledWith({ ...batch, createdBy: 9 });
    expect(mock(GenerateChargeBatchUseCase)).toHaveBeenCalledWith({ ...batch, createdBy: 9 });
    expect(mock(CreateIndividualChargeUseCase)).toHaveBeenCalledWith({ ...batch, studentId: 4, createdBy: 9 });
    expect(mock(ListChargesUseCase)).toHaveBeenCalledWith({
      criteria: expect.objectContaining({ status: 'pending' }),
      page: { page: 2, limit: 5 },
    });
    expect(mock(GetChargesSummaryUseCase)).toHaveBeenCalledWith({ limit: 10 });
    expect(mock(CancelChargeUseCase)).toHaveBeenCalledWith({ chargeId: 8 });
    expect(mock(GetChargeDocumentUseCase)).toHaveBeenCalledWith({ chargeId: 8, actor: financeUser });
  });
});
