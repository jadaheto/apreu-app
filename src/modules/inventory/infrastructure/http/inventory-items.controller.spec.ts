import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { CreateItemUseCase } from '../../application/create-item.use-case.js';
import { DeactivateItemUseCase } from '../../application/deactivate-item.use-case.js';
import { GetItemUseCase } from '../../application/get-item.use-case.js';
import { ListItemsUseCase } from '../../application/list-items.use-case.js';
import { ListStockMovementsUseCase } from '../../application/list-stock-movements.use-case.js';
import { RegisterStockMovementUseCase } from '../../application/register-stock-movement.use-case.js';
import { UpdateItemUseCase } from '../../application/update-item.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { ADMIN } from '../../testing/inventory-fixture.js';
import { ListItemsQueryDto } from './dto/inventory.dto.js';
import { InventoryItemsController } from './inventory-items.controller.js';

describe('InventoryItemsController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(InventoryItemsController, [
      ListItemsUseCase,
      GetItemUseCase,
      CreateItemUseCase,
      UpdateItemUseCase,
      DeactivateItemUseCase,
      RegisterStockMovementUseCase,
      ListStockMovementsUseCase,
    ]);
    await controller.list(Object.assign(new ListItemsQueryDto(), { search: 'cam', alert: 'low', categoryId: 2 }));
    expect(mock(ListItemsUseCase).execute).toHaveBeenCalledWith({
      search: 'cam',
      categoryId: 2,
      alert: 'low',
      includeInactive: undefined,
      page: { page: 1, limit: 20 },
    });
    await controller.get(3);
    expect(mock(GetItemUseCase).execute).toHaveBeenCalledWith(3);
    const dto = { name: 'Lápiz', sku: 'LAP', unitCost: 1, salePrice: 2, minStock: 1 };
    await controller.create(dto, ADMIN);
    expect(mock(CreateItemUseCase).execute).toHaveBeenCalledWith({ ...dto, categoryId: null, actor: ADMIN });
    await controller.update(3, { ...dto, categoryId: 2 });
    expect(mock(UpdateItemUseCase).execute).toHaveBeenCalledWith({ id: 3, ...dto, categoryId: 2 });
    await controller.deactivate(3);
    expect(mock(DeactivateItemUseCase).execute).toHaveBeenCalledWith(3);
    await controller.addMovement(3, { type: 'entrada', quantity: 2 }, ADMIN);
    expect(mock(RegisterStockMovementUseCase).execute).toHaveBeenCalledWith({
      itemId: 3,
      type: 'entrada',
      quantity: 2,
      actor: ADMIN,
    });
    await controller.movements(3, new PaginationQueryDto());
    expect(mock(ListStockMovementsUseCase).execute).toHaveBeenCalledWith({ itemId: 3, page: { page: 1, limit: 20 } });
  });
});
