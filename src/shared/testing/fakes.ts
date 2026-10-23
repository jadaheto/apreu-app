import type { ClockPort } from '../application/ports/clock.port.js';
import type { PasswordHasherPort } from '../application/ports/password-hasher.port.js';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port.js';

/** Clock frozen at a given instant; `advance` moves it forward. */
export class FixedClock implements ClockPort {
  constructor(private current = new Date('2026-03-15T10:00:00-05:00')) {}
  now(): Date {
    return new Date(this.current);
  }
  set(date: Date): void {
    this.current = date;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Reversible "hash" for fast, deterministic tests. */
export class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

/** Runs the work directly; counts transactions so tests can assert atomicity was requested. */
export class FakeUnitOfWork implements UnitOfWorkPort {
  transactions = 0;
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    this.transactions++;
    return work();
  }
}

/** Generic in-memory store with auto-incremented ids, base for repository fakes. */
export class InMemoryStore<T extends { id: number | null; isNew: boolean; assignId(id: number): void }> {
  readonly items = new Map<number, T>();
  private sequence = 0;

  save(item: T): void {
    if (item.isNew) item.assignId(++this.sequence);
    this.sequence = Math.max(this.sequence, item.id as number);
    this.items.set(item.id as number, item);
  }

  get(id: number): T | null {
    return this.items.get(id) ?? null;
  }

  all(): T[] {
    return [...this.items.values()];
  }
}

/** Records published events; subscriptions are kept so handlers can be exercised too. */
export class RecordingEventBus {
  readonly published: { name: string; occurredAt: Date; payload: any }[] = [];
  private readonly handlers = new Map<string, ((e: any) => unknown)[]>();
  async publish(event: { name: string; occurredAt: Date; payload: any }): Promise<void> {
    this.published.push(event);
    for (const handler of this.handlers.get(event.name) ?? []) await handler(event);
  }
  subscribe(name: string, handler: (e: any) => unknown): void {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }
}

/**
 * Chainable stand-in for a TypeORM `SelectQueryBuilder` that records the
 * `where`/`andWhere` conditions and parameters, so adapter specs can assert
 * the SQL they emit without a database. Terminal calls resolve to `result`.
 */
export class RecordingQueryBuilder {
  readonly conditions: string[] = [];
  readonly parameters: Record<string, unknown> = {};

  constructor(private readonly result: { one?: unknown; exists?: boolean; count?: number } = {}) {}

  where(condition: string, parameters: Record<string, unknown> = {}): this {
    this.conditions.push(condition);
    Object.assign(this.parameters, parameters);
    return this;
  }
  andWhere(condition: string, parameters: Record<string, unknown> = {}): this {
    return this.where(condition, parameters);
  }
  orderBy(): this {
    return this;
  }
  async getOne(): Promise<unknown> {
    return this.result.one ?? null;
  }
  async getExists(): Promise<boolean> {
    return this.result.exists ?? false;
  }
  async getCount(): Promise<number> {
    return this.result.count ?? 0;
  }

  /** A `TenantDataSource` whose repositories hand out this builder. */
  asDataSource<T>(): T {
    return { repository: async () => ({ createQueryBuilder: () => this }) } as unknown as T;
  }
}
