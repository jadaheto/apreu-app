import { TenantEntityRegistry } from '../../../../shared/infrastructure/persistence/tenant-entity-registry.js';
import { InventoryCategoryOrmEntity } from './inventory-category.orm-entity.js';
import { InventoryItemOrmEntity } from './inventory-item.orm-entity.js';
import { StockMovementOrmEntity } from './stock-movement.orm-entity.js';

TenantEntityRegistry.register(InventoryCategoryOrmEntity, InventoryItemOrmEntity, StockMovementOrmEntity);

export * from './typeorm-inventory-category.repository.js';
export * from './typeorm-inventory-item.repository.js';
export * from './typeorm-inventory-queries.js';
export * from './typeorm-stock-movement.repository.js';
