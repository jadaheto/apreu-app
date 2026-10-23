import { Module } from '@nestjs/common';
import { CreateItemUseCase } from './application/create-item.use-case.js';
import { DeactivateItemUseCase } from './application/deactivate-item.use-case.js';
import { DeleteCategoryUseCase } from './application/delete-category.use-case.js';
import { GetInventoryKpisUseCase } from './application/get-inventory-kpis.use-case.js';
import { GetInventoryValuationUseCase } from './application/get-inventory-valuation.use-case.js';
import { GetItemUseCase } from './application/get-item.use-case.js';
import { GetStockAlertsUseCase } from './application/get-stock-alerts.use-case.js';
import { ItemPresenter } from './application/item-presenter.js';
import { ListCategoriesUseCase } from './application/list-categories.use-case.js';
import { ListItemsUseCase } from './application/list-items.use-case.js';
import { ListStockMovementsUseCase } from './application/list-stock-movements.use-case.js';
import { INVENTORY_QUERIES } from './application/ports/inventory-queries.port.js';
import { RegisterStockMovementUseCase } from './application/register-stock-movement.use-case.js';
import { SaveCategoryUseCase } from './application/save-category.use-case.js';
import { StockMovementPublisher } from './application/stock-movement-publisher.js';
import { UpdateItemUseCase } from './application/update-item.use-case.js';
import { INVENTORY_CATEGORY_REPOSITORY } from './domain/inventory-category.repository.js';
import { INVENTORY_ITEM_REPOSITORY } from './domain/inventory-item.repository.js';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/stock-movement.repository.js';
import { InventoryCategoriesController } from './infrastructure/http/inventory-categories.controller.js';
import { InventoryItemsController } from './infrastructure/http/inventory-items.controller.js';
import { InventoryReportsController } from './infrastructure/http/inventory-reports.controller.js';
import {
  TypeOrmInventoryCategoryRepository,
  TypeOrmInventoryItemRepository,
  TypeOrmInventoryQueries,
  TypeOrmStockMovementRepository,
} from './infrastructure/persistence/index.js';

/**
 * Inventory context (legacy `apreu/inventory/index.php`): categories, items,
 * kardex of stock movements, minimum-stock alerts and valuation.
 * Composition root binding the ports to their adapters.
 */
@Module({
  controllers: [InventoryItemsController, InventoryCategoriesController, InventoryReportsController],
  providers: [
    ItemPresenter,
    StockMovementPublisher,
    ListItemsUseCase,
    GetItemUseCase,
    CreateItemUseCase,
    UpdateItemUseCase,
    DeactivateItemUseCase,
    RegisterStockMovementUseCase,
    ListStockMovementsUseCase,
    GetInventoryKpisUseCase,
    GetStockAlertsUseCase,
    GetInventoryValuationUseCase,
    ListCategoriesUseCase,
    SaveCategoryUseCase,
    DeleteCategoryUseCase,
    { provide: INVENTORY_ITEM_REPOSITORY, useClass: TypeOrmInventoryItemRepository },
    { provide: INVENTORY_CATEGORY_REPOSITORY, useClass: TypeOrmInventoryCategoryRepository },
    { provide: STOCK_MOVEMENT_REPOSITORY, useClass: TypeOrmStockMovementRepository },
    { provide: INVENTORY_QUERIES, useClass: TypeOrmInventoryQueries },
  ],
})
export class InventoryModule {}
