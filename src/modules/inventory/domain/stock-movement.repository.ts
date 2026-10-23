import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import type { StockMovement } from './stock-movement.js';

/** Output port for the kardex (`inventory_movements`). */
export interface StockMovementRepository {
  save(movement: StockMovement): Promise<void>;
  /** Newest first. */
  listByItem(itemId: number, page: PageRequest): Promise<Paginated<StockMovement>>;
}

export const STOCK_MOVEMENT_REPOSITORY = Symbol('StockMovementRepository');
