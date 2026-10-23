import type { DataSource, DataSourceOptions } from 'typeorm';
import { TEST_ENVIRONMENT } from '../../testing/kernel-stub.module.js';
import type { Environment } from '../config/environment.js';
import { BackgroundTasks } from '../runtime/background-tasks.js';
import type { Tenant } from '../tenancy/tenant.js';
import { TenantConnectionManager } from './tenant-connection-manager.js';

interface FakeSource {
  options: DataSourceOptions;
  initialize: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  driver: { master: { totalCount: number; idleCount: number; waitingCount: number } };
}

class TestableManager extends TenantConnectionManager {
  readonly created: FakeSource[] = [];
  failNext = false;

  protected override createDataSource(options: DataSourceOptions): DataSource {
    const fail = this.failNext;
    this.failNext = false;
    const source: FakeSource = {
      options,
      initialize: vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve())),
      destroy: vi.fn(() => Promise.resolve()),
      driver: { master: { totalCount: 1, idleCount: 1, waitingCount: 0 } },
    };
    this.created.push(source);
    return source as unknown as DataSource;
  }
}

const tenant = (slug: string): Tenant => ({ id: 1, slug, name: slug, status: 'active', databaseName: `apreu_${slug}` });
const MINUTE = 60_000;

describe('TenantConnectionManager', () => {
  let manager: TestableManager;
  const build = (env: Partial<Environment> = {}) => new TestableManager({ ...TEST_ENVIRONMENT, ...env });

  beforeEach(() => {
    vi.useFakeTimers();
    manager = build();
  });

  afterEach(async () => {
    await manager.onModuleDestroy();
    vi.useRealTimers();
  });

  it('opens one PostgreSQL pool per school with the Bogota time zone and reuses it', async () => {
    const first = await manager.dataSourceFor(tenant('norte'));
    const again = await manager.dataSourceFor(tenant('norte'));

    expect(first).toBe(again);
    expect(manager.created).toHaveLength(1);
    expect(manager.created[0]!.options).toMatchObject({
      type: 'postgres',
      database: 'apreu_norte',
      port: 5432,
      synchronize: false,
      extra: { max: 10, idleTimeoutMillis: 30_000, options: '-c TimeZone=America/Bogota' },
    });
  });

  it('does not cache a pool whose initialization failed', async () => {
    manager.failNext = true;
    await expect(manager.dataSourceFor(tenant('norte'))).rejects.toThrow('down');
    await Promise.resolve();

    await manager.dataSourceFor(tenant('norte'));
    expect(manager.created).toHaveLength(2);
  });

  it('closes pools unused for TENANT_POOL_IDLE_MINUTES and reopens them on demand', async () => {
    await manager.dataSourceFor(tenant('norte'));
    await manager.dataSourceFor(tenant('sur'));
    const start = Date.now();

    vi.setSystemTime(start + 20 * MINUTE);
    await manager.dataSourceFor(tenant('sur')); // keeps "sur" alive
    await manager.closeIdlePools(start + 30 * MINUTE);

    expect(manager.created[0]!.destroy).toHaveBeenCalledOnce();
    expect(manager.created[1]!.destroy).not.toHaveBeenCalled();
    expect(manager.openPools).toBe(1);

    await manager.dataSourceFor(tenant('norte'));
    expect(manager.created).toHaveLength(3);
  });

  it('never closes a pool with connections checked out', async () => {
    await manager.dataSourceFor(tenant('norte'));
    manager.created[0]!.driver.master.idleCount = 0;

    await manager.closeIdlePools(Date.now() + 60 * MINUTE);

    expect(manager.created[0]!.destroy).not.toHaveBeenCalled();
    expect(manager.openPools).toBe(1);
  });

  it('sweeps idle pools periodically', async () => {
    await manager.dataSourceFor(tenant('norte'));

    await vi.advanceTimersByTimeAsync(31 * MINUTE);

    expect(manager.created[0]!.destroy).toHaveBeenCalledOnce();
    expect(manager.openPools).toBe(0);
  });

  it('keeps pools open forever when the idle limit is 0', async () => {
    manager = build({ tenantPoolIdleMinutes: 0 });
    await manager.dataSourceFor(tenant('norte'));

    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTE);
    await manager.closeIdlePools(Date.now() + 24 * 60 * MINUTE);

    expect(manager.created[0]!.destroy).not.toHaveBeenCalled();
  });

  it('destroys every pool on shutdown', async () => {
    await manager.dataSourceFor(tenant('norte'));
    await manager.dataSourceFor(tenant('sur'));

    await manager.onModuleDestroy();

    expect(manager.created.every((source) => source.destroy.mock.calls.length === 1)).toBe(true);
    expect(manager.openPools).toBe(0);
  });

  it('waits for in-flight background tasks before destroying the pools', async () => {
    vi.useRealTimers();
    const tasks = new BackgroundTasks();
    const local = new TestableManager(TEST_ENVIRONMENT, tasks);
    await local.dataSourceFor(tenant('norte'));
    const order: string[] = [];
    tasks.track(new Promise<void>((resolve) => setTimeout(() => resolve(void order.push('audit')), 10)));
    local.created[0]!.destroy.mockImplementation(async () => void order.push('destroy'));

    await local.onModuleDestroy();

    expect(order).toEqual(['audit', 'destroy']);
    vi.useFakeTimers();
  });
});
