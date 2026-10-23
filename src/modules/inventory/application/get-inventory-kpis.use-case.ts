import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { INVENTORY_QUERIES, type InventoryQueriesPort } from './ports/inventory-queries.port.js';

export interface InventoryKpisView {
  totalItems: number;
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
}

/** KPIs of the inventory screen (RN-INV-08, consistent with the alert filters — bug 26). */
@Injectable()
export class GetInventoryKpisUseCase implements UseCase<void, InventoryKpisView> {
  constructor(@Inject(INVENTORY_QUERIES) private readonly queries: InventoryQueriesPort) {}

  async execute(): Promise<InventoryKpisView> {
    const summary = await this.queries.summary();
    return { ...summary, inventoryValue: summary.inventoryValue.amount };
  }
}
