import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';

export interface InventoryCategoryProps {
  name: string;
  createdAt: Date | null;
}

/**
 * Category of inventory items (`inventory_categories`). The legacy had no
 * management screen; names are unique (checked by the use cases).
 */
export class InventoryCategory extends Entity<InventoryCategoryProps> {
  private constructor(id: EntityId, props: InventoryCategoryProps) {
    super(id, props);
  }

  static create(name: string): InventoryCategory {
    return new InventoryCategory(null, { name: InventoryCategory.validName(name), createdAt: null });
  }

  static restore(id: number, props: InventoryCategoryProps): InventoryCategory {
    return new InventoryCategory(id, { ...props });
  }

  private static validName(raw: string): string {
    const name = raw?.trim();
    Guard.againstEmpty(name, 'nombre de la categoría');
    Guard.againstMaxLength(name, 150, 'nombre de la categoría');
    return name;
  }

  get name(): string {
    return this.props.name;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  rename(name: string): void {
    this.props.name = InventoryCategory.validName(name);
  }
}
