import { DeleteCategoryUseCase } from '../../application/delete-category.use-case.js';
import { ListCategoriesUseCase } from '../../application/list-categories.use-case.js';
import { SaveCategoryUseCase } from '../../application/save-category.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { InventoryCategoriesController } from './inventory-categories.controller.js';

describe('InventoryCategoriesController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(InventoryCategoriesController, [
      ListCategoriesUseCase,
      SaveCategoryUseCase,
      DeleteCategoryUseCase,
    ]);
    await expect(controller.list()).resolves.toEqual({ ok: 'ListCategoriesUseCase' });
    await controller.create({ name: 'Aseo' });
    await controller.rename(4, { name: 'Limpieza' });
    expect(mock(SaveCategoryUseCase).execute.mock.calls).toEqual([[{ name: 'Aseo' }], [{ id: 4, name: 'Limpieza' }]]);
    await controller.remove(4);
    expect(mock(DeleteCategoryUseCase).execute).toHaveBeenCalledWith(4);
  });
});
