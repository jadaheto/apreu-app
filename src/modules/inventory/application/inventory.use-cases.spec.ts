import { InventoryCategory } from '../domain/inventory-category.js';
import { ADMIN, createInventoryFixture, type InventoryFixture } from '../testing/inventory-fixture.js';
import { DeactivateItemUseCase } from './deactivate-item.use-case.js';
import { DeleteCategoryUseCase } from './delete-category.use-case.js';
import { GetInventoryKpisUseCase } from './get-inventory-kpis.use-case.js';
import { GetInventoryValuationUseCase } from './get-inventory-valuation.use-case.js';
import { GetItemUseCase } from './get-item.use-case.js';
import { GetStockAlertsUseCase } from './get-stock-alerts.use-case.js';
import { ListCategoriesUseCase } from './list-categories.use-case.js';
import { ListItemsUseCase } from './list-items.use-case.js';
import { ListStockMovementsUseCase } from './list-stock-movements.use-case.js';
import { RegisterStockMovementUseCase } from './register-stock-movement.use-case.js';
import { SaveCategoryUseCase } from './save-category.use-case.js';
import { UpdateItemUseCase } from './update-item.use-case.js';

describe('inventory use cases', () => {
  let f: InventoryFixture;
  let uniforms: number;

  const item = (overrides: Record<string, unknown> = {}) =>
    f.createItem.execute({
      categoryId: uniforms,
      name: 'Camiseta talla 10',
      sku: 'CAM-10',
      unitCost: 20000,
      salePrice: 35000,
      minStock: 5,
      initialStock: 10,
      actor: ADMIN,
      ...overrides,
    });

  beforeEach(async () => {
    f = createInventoryFixture();
    const category = InventoryCategory.create('Uniformes');
    await f.categories.save(category);
    uniforms = category.id as number;
  });

  describe('CreateItemUseCase', () => {
    it('creates the item and records the opening stock in the kardex', async () => {
      const view = await item();
      expect(view).toMatchObject({
        sku: 'CAM-10',
        stock: 10,
        categoryName: 'Uniformes',
        stockStatus: 'ok',
        stockValue: 200000,
      });
      expect(f.movements.store.all()).toEqual([expect.objectContaining({ type: 'inicial', quantity: 10, userId: 1 })]);
      expect(f.bus.published[0]).toMatchObject({
        name: 'inventory.stock-movement-recorded',
        payload: expect.objectContaining({ sku: 'CAM-10', type: 'inicial', quantity: 10, totalCost: 200000 }),
      });
      expect(f.uow.transactions).toBe(1);
    });

    it('creates without movements when there is no opening stock', async () => {
      await item({ initialStock: 0 });
      expect(f.movements.store.all()).toHaveLength(0);
      expect(f.bus.published).toHaveLength(0);
    });

    it('rejects duplicated SKUs and unknown categories (bug 23)', async () => {
      await item();
      await expect(item({ sku: 'cam-10' })).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(item({ sku: 'OTRO', categoryId: 99 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('UpdateItemUseCase', () => {
    it('edits data but never the stock', async () => {
      const created = await item();
      await item({ sku: 'CAM-12', name: 'Camiseta 12' });
      const update = new UpdateItemUseCase(f.items, f.categories, f.presenter);
      const base = {
        categoryId: null,
        name: 'Camiseta T10',
        sku: 'CAM-10',
        unitCost: 21000,
        salePrice: 36000,
        minStock: 3,
      };
      await expect(update.execute({ id: created.id, ...base, stock: 999 } as never)).resolves.toMatchObject({
        name: 'Camiseta T10',
        stock: 10,
        categoryName: null,
      });
      await expect(update.execute({ id: created.id, ...base, sku: 'CAM-12' })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await expect(update.execute({ id: 99, ...base })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('RegisterStockMovementUseCase', () => {
    const register = () =>
      new RegisterStockMovementUseCase(f.items, f.movements, f.uow, f.clock, f.presenter, f.publisher);

    it('locks the item, records the movement and publishes the event', async () => {
      const created = await item();
      const result = await register().execute({
        itemId: created.id,
        type: 'salida',
        quantity: 4,
        reason: 'Venta',
        actor: ADMIN,
      });
      expect(result.message).toBe('Salida de 4 unidades registrada. Stock actual: 6');
      expect(result.movement).toMatchObject({ quantity: -4, balanceAfter: 6, reason: 'Venta' });
      expect(result.item.stock).toBe(6);
      expect(f.items.locks).toBe(1);
      expect(f.bus.published.at(-1)?.payload).toMatchObject({ type: 'salida', quantity: -4, balanceAfter: 6 });
    });

    it('updates the average cost on purchases', async () => {
      const created = await item();
      const result = await register().execute({
        itemId: created.id,
        type: 'entrada',
        quantity: 10,
        unitCost: 30000,
        actor: ADMIN,
      });
      expect(result.item).toMatchObject({ stock: 20, unitCost: 25000, stockValue: 500000 });
    });

    it('rejects invalid movements without side effects', async () => {
      const created = await item();
      await expect(
        register().execute({ itemId: created.id, type: 'salida', quantity: 11, actor: ADMIN }),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
      await expect(
        register().execute({ itemId: created.id, type: 'inicial' as never, quantity: 1, actor: ADMIN }),
      ).rejects.toMatchObject({ code: 'INVALID_OPTION' });
      await expect(
        register().execute({ itemId: 99, type: 'entrada', quantity: 1, actor: ADMIN }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      expect(f.movements.store.all()).toHaveLength(1);
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      await item();
      await item({ sku: 'CAM-12', name: 'Camiseta 12', initialStock: 3 });
      await item({ sku: 'LAP-01', name: 'Lápiz', categoryId: null, initialStock: 0, unitCost: 1000 });
    });

    it('lists with filters and consistent alerts (bug 26)', async () => {
      const list = new ListItemsUseCase(f.items, f.presenter);
      const page = { page: 1, limit: 10 };
      expect((await list.execute({ page })).items.map((i) => i.sku)).toEqual(['CAM-12', 'CAM-10', 'LAP-01']);
      expect((await list.execute({ alert: 'any', page })).total).toBe(2);
      expect((await list.execute({ alert: 'low', page })).items.map((i) => i.sku)).toEqual(['CAM-12']);
      expect((await list.execute({ alert: 'out', page })).items.map((i) => i.sku)).toEqual(['LAP-01']);
      expect((await list.execute({ search: 'lápiz', page })).total).toBe(1);
      expect((await list.execute({ categoryId: uniforms, page })).total).toBe(2);
    });

    it('computes KPIs, alerts and valuation over active items', async () => {
      await expect(new GetInventoryKpisUseCase(f.queries).execute()).resolves.toEqual({
        totalItems: 3,
        inventoryValue: 260000,
        lowStock: 1,
        outOfStock: 1,
      });
      const alerts = await new GetStockAlertsUseCase(f.items, f.presenter).execute();
      expect(alerts.outOfStock.map((i) => i.sku)).toEqual(['LAP-01']);
      expect(alerts.lowStock.map((i) => i.sku)).toEqual(['CAM-12']);
      const valuation = await new GetInventoryValuationUseCase(f.queries).execute();
      expect(valuation).toMatchObject({ totalUnits: 13, totalValue: 260000 });
      expect(valuation.categories).toContainEqual(
        expect.objectContaining({ categoryName: 'Sin categoría', items: 1, value: 0 }),
      );
    });

    it('gets an item, its kardex and deactivates it', async () => {
      const [first] = f.items.store.all();
      const get = new GetItemUseCase(f.items, f.presenter);
      await expect(get.execute(first.id as number)).resolves.toMatchObject({ sku: 'CAM-10' });
      await expect(get.execute(99)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const kardex = await new ListStockMovementsUseCase(f.items, f.movements).execute({
        itemId: first.id as number,
        page: { page: 1, limit: 10 },
      });
      expect(kardex.items).toEqual([expect.objectContaining({ type: 'inicial', quantity: 10 })]);
      await expect(
        new ListStockMovementsUseCase(f.items, f.movements).execute({ itemId: 99, page: { page: 1, limit: 10 } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const deactivate = new DeactivateItemUseCase(f.items);
      await deactivate.execute(first.id as number);
      expect((await new GetInventoryKpisUseCase(f.queries).execute()).totalItems).toBe(2);
      await expect(deactivate.execute(99)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('categories', () => {
    it('creates, renames, lists and deletes categories with unique names', async () => {
      const save = new SaveCategoryUseCase(f.categories);
      const created = await save.execute({ name: 'Útiles' });
      await expect(save.execute({ name: 'uniformes' })).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(save.execute({ id: created.id, name: 'Útiles escolares' })).resolves.toMatchObject({
        name: 'Útiles escolares',
      });
      await expect(save.execute({ id: 99, name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect((await new ListCategoriesUseCase(f.categories).execute()).map((c) => c.name)).toEqual([
        'Uniformes',
        'Útiles escolares',
      ]);

      const remove = new DeleteCategoryUseCase(f.categories, f.items);
      await item();
      await expect(remove.execute(uniforms)).rejects.toMatchObject({ code: 'CONFLICT' });
      await remove.execute(created.id);
      await expect(remove.execute(created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
