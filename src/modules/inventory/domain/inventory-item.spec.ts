import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { InventoryCategory } from './inventory-category.js';
import { InventoryItem } from './inventory-item.js';
import { Sku } from './sku.js';

const details = {
  categoryId: 1,
  name: 'Camiseta talla 10',
  sku: 'uni-cam-10',
  unitCost: 20000,
  salePrice: 35000,
  minStock: 5,
};
const at = new Date('2026-03-15T15:00:00Z');

const persisted = (stock = 0) => {
  const item = InventoryItem.create(details);
  item.assignId(1);
  if (stock > 0) item.recordMovement({ type: 'inicial', quantity: stock, userId: 1, at });
  return item;
};

describe('Sku', () => {
  it('normalizes to upper case and validates characters', () => {
    expect(Sku.create(' uni-cam/10 ').toString()).toBe('UNI-CAM/10');
    expect(() => Sku.create('con espacio')).toThrow(expect.objectContaining({ code: 'INVALID_SKU' }));
    expect(() => Sku.create('')).toThrow(expect.objectContaining({ code: 'INVALID_SKU' }));
  });
});

describe('InventoryCategory', () => {
  it('requires a name', () => {
    const category = InventoryCategory.create(' Uniformes ');
    expect(category.name).toBe('Uniformes');
    expect(() => category.rename('')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
  });
});

describe('InventoryItem', () => {
  it('is created with zero stock and defaults', () => {
    const item = InventoryItem.create(details);
    expect(item).toMatchObject({ stock: 0, unit: 'und', isActive: true, stockStatus: 'out', location: null });
    expect(item.sku.toString()).toBe('UNI-CAM-10');
  });

  it.each([
    [{ unitCost: -1 }, 'NEGATIVE_VALUE'],
    [{ salePrice: -1 }, 'NEGATIVE_VALUE'],
    [{ minStock: 1.5 }, 'INVALID_QUANTITY'],
    [{ name: ' ' }, 'REQUIRED_FIELD'],
  ])('rejects invalid details %o', (override, code) => {
    expect(() => InventoryItem.create({ ...details, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('computes stock status and value (RN-INV-06/07)', () => {
    const item = persisted(5);
    expect(item.stockStatus).toBe('low');
    expect(item.stockValue.amount).toBe(100000);
    item.recordMovement({ type: 'entrada', quantity: 1, userId: 1, at });
    expect(item.stockStatus).toBe('ok');
  });

  it('records entradas with weighted average cost', () => {
    const item = persisted(10);
    const movement = item.recordMovement({
      type: 'entrada',
      quantity: 10,
      unitCost: Money.of(30000),
      reason: 'Compra',
      userId: 2,
      at,
    });
    expect(movement).toMatchObject({ type: 'entrada', quantity: 10, balanceAfter: 20, reason: 'Compra', userId: 2 });
    expect(movement.unitCost.amount).toBe(30000);
    expect(movement.totalCost.amount).toBe(300000);
    expect(item.unitCost.amount).toBe(25000);
  });

  it('never lets the stock go negative (RN-INV-03)', () => {
    const item = persisted(3);
    expect(() => item.recordMovement({ type: 'salida', quantity: 4, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_STOCK', message: 'No hay suficiente stock para esta salida.' }),
    );
    const movement = item.recordMovement({ type: 'salida', quantity: 3, userId: 1, at });
    expect(movement).toMatchObject({ quantity: -3, balanceAfter: 0 });
    expect(movement.unitCost.amount).toBe(20000);
  });

  it('adjusts to a physical count with a reason', () => {
    const item = persisted(10);
    expect(() => item.recordMovement({ type: 'ajuste', quantity: 8, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'REQUIRED_FIELD' }),
    );
    expect(() => item.recordMovement({ type: 'ajuste', quantity: 10, reason: 'Conteo', userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'NO_STOCK_CHANGE' }),
    );
    expect(item.recordMovement({ type: 'ajuste', quantity: 8, reason: 'Conteo', userId: 1, at })).toMatchObject({
      quantity: -2,
      balanceAfter: 8,
    });
  });

  it('validates quantities, initial stock and inactive items', () => {
    const item = persisted(2);
    expect(() => item.recordMovement({ type: 'entrada', quantity: 0, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'INVALID_QUANTITY' }),
    );
    expect(() => item.recordMovement({ type: 'inicial', quantity: 1, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'INITIAL_STOCK_EXISTS' }),
    );
    expect(() => item.recordMovement({ type: 'otro' as never, quantity: 1, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
    expect(() =>
      InventoryItem.create(details).recordMovement({ type: 'entrada', quantity: 1, userId: 1, at }),
    ).toThrow();
    item.deactivate();
    expect(() => item.recordMovement({ type: 'entrada', quantity: 1, userId: 1, at })).toThrow(
      expect.objectContaining({ code: 'ITEM_INACTIVE' }),
    );
  });

  it('updates data without touching the stock (bug 23)', () => {
    const item = persisted(4);
    item.update({ ...details, name: 'Camiseta T10', location: ' Bodega ', unit: 'par' });
    expect(item).toMatchObject({ name: 'Camiseta T10', stock: 4, location: 'Bodega', unit: 'par' });
  });
});
