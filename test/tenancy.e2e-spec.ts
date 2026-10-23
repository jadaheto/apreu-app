import { createE2eApp, DIRECTOR, type E2eContext } from './support/e2e-app.js';
import { E2E, withMasterDb } from './support/e2e-databases.js';
import { expectStatus } from './support/http.js';

describe('tenancy (E2E)', () => {
  let ctx: E2eContext;
  let token: string;
  const school = E2E.tenantToSuspend;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });
  afterAll(async () => {
    await withMasterDb((db) => db.query("UPDATE tenants SET status = 'active' WHERE slug = $1", [school]));
    await ctx?.close();
  });

  const invalidate = (slug: string, internalToken: string | null = E2E.internalToken) => {
    const req = ctx.api(undefined, '').post(`/api/internal/tenants/${slug}/invalidate`).unset('X-Tenant');
    return internalToken ? req.set('X-Internal-Token', internalToken) : req;
  };

  it('serves an active school', async () => {
    token = await ctx.login(DIRECTOR.email, DIRECTOR.password, school);
    expectStatus(await ctx.api(token, school).get('/api/auth/me'), 200);
  });

  it('rejects tokens issued for another school', async () => {
    expectStatus(await ctx.api(token, E2E.tenant).get('/api/auth/me'), 401, 403);
  });

  it('protects the internal invalidation endpoint', async () => {
    expectStatus(await invalidate(school, null), 401);
    expectStatus(await invalidate(school, 'token-incorrecto'), 401);
  });

  it('rejects a school suspended in the master DB right after the invalidation call', async () => {
    await withMasterDb((db) => db.query("UPDATE tenants SET status = 'suspended' WHERE slug = $1", [school]));
    // Cached (TENANT_STATUS_TTL_SECONDS = 60 in the E2E env): still served until invalidated.
    expectStatus(await ctx.api(token, school).get('/api/auth/me'), 200);

    expectStatus(await invalidate(school), 204);
    const blocked = await ctx.api(token, school).get('/api/auth/me');
    expectStatus(blocked, 403);
    expect(blocked.body.message).toContain('suspendido');
    const login = await ctx.api(undefined, school).post('/api/auth/login').send(DIRECTOR);
    expectStatus(login, 403);
    expectStatus(await ctx.api(undefined, school).get('/api/institution/branding'), 403);

    // Other schools are unaffected; invalidation is idempotent.
    expectStatus(await ctx.api(undefined, E2E.tenant).get('/api/institution/branding'), 200);
    expectStatus(await invalidate(school), 204);
  });

  it('serves it again once reactivated and invalidated', async () => {
    await withMasterDb((db) => db.query("UPDATE tenants SET status = 'active' WHERE slug = $1", [school]));
    expectStatus(await invalidate(school), 204);
    expectStatus(await ctx.api(token, school).get('/api/auth/me'), 200);
  });

  it('resolves a legacy slug stored with upper case in the master DB', async () => {
    await withMasterDb((db) =>
      db.query(
        "INSERT INTO tenants (slug, name, status, tables_created, db_name) VALUES ('E2E-Legado', 'Legado', 'active', true, $1)",
        [E2E.tenantDb],
      ),
    );
    expectStatus(await ctx.api(undefined, 'e2e-legado').get('/api/institution/branding'), 200);
    expectStatus(await ctx.api(undefined, 'E2E-LEGADO').get('/api/institution/branding'), 200);
  });

  it('answers 404 for an unknown school', async () => {
    expectStatus(await ctx.api(undefined, 'colegio-inexistente').get('/api/institution/branding'), 404);
  });
});
