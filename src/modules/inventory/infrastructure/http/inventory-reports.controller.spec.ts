import { GetInventoryKpisUseCase } from '../../application/get-inventory-kpis.use-case.js';
import { GetInventoryValuationUseCase } from '../../application/get-inventory-valuation.use-case.js';
import { GetStockAlertsUseCase } from '../../application/get-stock-alerts.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { InventoryReportsController } from './inventory-reports.controller.js';

describe('InventoryReportsController', () => {
  it('delegates each indicator to its use case', async () => {
    const { controller } = await buildController(InventoryReportsController, [
      GetInventoryKpisUseCase,
      GetStockAlertsUseCase,
      GetInventoryValuationUseCase,
    ]);
    await expect(controller.getKpis()).resolves.toEqual({ ok: 'GetInventoryKpisUseCase' });
    await expect(controller.getAlerts()).resolves.toEqual({ ok: 'GetStockAlertsUseCase' });
    await expect(controller.getValuation()).resolves.toEqual({ ok: 'GetInventoryValuationUseCase' });
  });
});
