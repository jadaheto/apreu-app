import { Role } from '../../../../shared/domain/role.js';
import { GetReceiptUseCase } from '../../application/get-receipt.use-case.js';
import { ListMyStudentsUseCase } from '../../application/list-my-students.use-case.js';
import { actorWith } from '../../testing/fixtures.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { PortalController } from './portal.controller.js';
import { ReceiptsController } from './receipts.controller.js';

describe('ReceiptsController', () => {
  it('passes the actor for the ownership check', async () => {
    const { controller, mock } = await controllerWithMocks(ReceiptsController, [GetReceiptUseCase]);
    const parent = actorWith(Role.PARENT);
    await controller.get('REC-2026-000001', parent);
    expect(mock(GetReceiptUseCase)).toHaveBeenCalledWith({ receiptNumber: 'REC-2026-000001', actor: parent });
  });
});

describe('PortalController', () => {
  it('lists the students of the actor', async () => {
    const { controller, mock } = await controllerWithMocks(PortalController, [ListMyStudentsUseCase]);
    const student = actorWith(Role.STUDENT);
    await controller.students(student);
    expect(mock(ListMyStudentsUseCase)).toHaveBeenCalledWith(student);
  });
});
