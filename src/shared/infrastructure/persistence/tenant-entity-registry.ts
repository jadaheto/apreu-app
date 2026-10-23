import type { EntitySchema, MixedList } from 'typeorm';

// oxlint-disable-next-line typescript/no-unsafe-function-type
type EntityTarget = Function | EntitySchema;

/**
 * Collects the ORM entities of every bounded context.
 *
 * Tenant data sources are created lazily (first request of each school), so
 * by then every module has registered its entities from its own
 * `persistence/index.ts`. Keeping registration inside each module preserves
 * the open/closed principle: adding a context never edits shared code.
 */
export class TenantEntityRegistry {
  private static readonly entities = new Set<EntityTarget>();

  static register(...entities: EntityTarget[]): void {
    entities.forEach((entity) => TenantEntityRegistry.entities.add(entity));
  }

  static all(): MixedList<EntityTarget> {
    return [...TenantEntityRegistry.entities];
  }
}
