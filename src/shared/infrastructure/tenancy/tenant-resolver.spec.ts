import { ForbiddenError, NotFoundError, BusinessRuleViolationError } from '../../domain/domain-error.js';
import type { Environment } from '../config/environment.js';
import type { Tenant } from './tenant.js';
import type { TenantLookup } from './tenant-registry.js';
import { TenantResolver } from './tenant-resolver.js';

const tenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 1,
  slug: 'colegio-a',
  name: 'Colegio A',
  status: 'active',
  databaseName: 'apreu_colegio_a',
  ...overrides,
});

const build = (stored: Tenant | null, env: Partial<Environment> = {}) => {
  const lookup = {
    findBySlug: vi.fn().mockResolvedValue(stored),
    findStatusBySlug: vi.fn().mockResolvedValue(stored?.status ?? null),
  } satisfies TenantLookup;
  let now = 0;
  const clock = { now: () => new Date(now) };
  const resolver = new TenantResolver(
    lookup,
    { defaultTenant: null, tenantCacheTtlSeconds: 60, tenantStatusTtlSeconds: 5, ...env } as Environment,
    clock,
  );
  return { resolver, lookup, advance: (ms: number) => (now += ms) };
};

describe('TenantResolver', () => {
  it('resolves an active tenant by slug (case insensitive)', async () => {
    const { resolver } = build(tenant());
    await expect(resolver.resolve('Colegio-A')).resolves.toEqual(tenant());
  });

  it('uses the default tenant when no slug is given', async () => {
    const { resolver, lookup } = build(tenant(), { defaultTenant: 'colegio-a' });
    await resolver.resolve(undefined);
    expect(lookup.findBySlug).toHaveBeenCalledWith('colegio-a');
  });

  it('requires a slug when there is no default tenant', async () => {
    const { resolver } = build(tenant());
    await expect(resolver.resolve(undefined)).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it('rejects malformed slugs without querying the master database', async () => {
    const { resolver, lookup } = build(tenant());
    await expect(resolver.resolve('../etc')).rejects.toThrow(/inválido/);
    expect(lookup.findBySlug).not.toHaveBeenCalled();
  });

  it('fails with NotFound for unknown tenants', async () => {
    const { resolver } = build(null);
    await expect(resolver.resolve('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('blocks suspended tenants', async () => {
    const { resolver } = build(tenant({ status: 'suspended' }));
    await expect(resolver.resolve('colegio-a')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('caches lookups until the TTL expires', async () => {
    const { resolver, lookup, advance } = build(tenant());
    await resolver.resolve('colegio-a');
    await resolver.resolve('colegio-a');
    expect(lookup.findBySlug).toHaveBeenCalledTimes(1);

    advance(61_000);
    await resolver.resolve('colegio-a');
    expect(lookup.findBySlug).toHaveBeenCalledTimes(2);
  });

  it('re-reads only the status of a cached tenant after the short status TTL', async () => {
    const { resolver, lookup, advance } = build(tenant());
    await resolver.resolve('colegio-a');
    advance(4_000);
    await resolver.resolve('colegio-a');
    expect(lookup.findStatusBySlug).not.toHaveBeenCalled();

    advance(2_000);
    lookup.findStatusBySlug.mockResolvedValueOnce('suspended');
    await expect(resolver.resolve('colegio-a')).rejects.toBeInstanceOf(ForbiddenError);
    expect(lookup.findStatusBySlug).toHaveBeenCalledWith('colegio-a');
    expect(lookup.findBySlug).toHaveBeenCalledTimes(1);
  });

  it('checks the status on every request when the status TTL is zero', async () => {
    const { resolver, lookup } = build(tenant(), { tenantStatusTtlSeconds: 0 });
    await resolver.resolve('colegio-a');
    await resolver.resolve('colegio-a');
    await resolver.resolve('colegio-a');
    expect(lookup.findStatusBySlug).toHaveBeenCalledTimes(2);
  });

  it('forgets a cached tenant that no longer exists', async () => {
    const { resolver, lookup, advance } = build(tenant());
    await resolver.resolve('colegio-a');
    advance(6_000);
    lookup.findStatusBySlug.mockResolvedValueOnce(null);
    await expect(resolver.resolve('colegio-a')).rejects.toBeInstanceOf(NotFoundError);
    lookup.findBySlug.mockResolvedValueOnce(null);
    await expect(resolver.resolve('colegio-a')).rejects.toBeInstanceOf(NotFoundError);
    expect(lookup.findBySlug).toHaveBeenCalledTimes(2);
  });

  it('reloads the tenant after an explicit invalidation', async () => {
    const { resolver, lookup } = build(tenant());
    await resolver.resolve('colegio-a');
    expect(resolver.invalidate('Colegio-A')).toBe(true);
    expect(resolver.invalidate('colegio-a')).toBe(false);
    lookup.findBySlug.mockResolvedValueOnce(tenant({ status: 'suspended' }));
    await expect(resolver.resolve('colegio-a')).rejects.toBeInstanceOf(ForbiddenError);
    expect(lookup.findBySlug).toHaveBeenCalledTimes(2);
  });

  it('validates the slug to invalidate', () => {
    const { resolver } = build(tenant());
    expect(() => resolver.invalidate('../x')).toThrow(/inválido/);
  });
});
