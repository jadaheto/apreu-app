import { createE2eApp, DIRECTOR, type E2eContext, todayInBogota, uniqueSuffix } from './support/e2e-app.js';
import { withTenantDb } from './support/e2e-databases.js';
import { bogotaDateOf, eventually, NEW_PASSWORD } from './support/fixtures.js';

describe('identity (E2E)', () => {
  let ctx: E2eContext;
  let director: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });
  afterAll(() => ctx?.close());

  it('health check needs neither school nor token', async () => {
    const res = await ctx.api(undefined, '').get('/health').unset('X-Tenant');
    expect(res.status).toBe(200);
  });

  it('logs in with the e-mail in upper case and returns the profile', async () => {
    const res = await ctx
      .api()
      .post('/api/auth/login')
      .send({ email: '  DIRECTOR@Demo.CO ', password: DIRECTOR.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: 'director@demo.co', role: 'admin', mustChangePassword: false });
    director = res.body.accessToken;

    const me = await ctx.api(director).get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'director@demo.co', role: 'admin' });
    // last_login is a timestamptz: returned as an ISO instant that is "now" and today in Bogotá.
    expect(Math.abs(Date.parse(me.body.lastLogin) - Date.now())).toBeLessThan(60_000);
    expect(bogotaDateOf(me.body.lastLogin)).toBe(todayInBogota());
  });

  it('rejects a wrong password without revealing which field failed', async () => {
    const res = await ctx.api().post('/api/auth/login').send({ email: DIRECTOR.email, password: 'NoEsLaClave1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Correo o contraseña incorrectos.');
  });

  it('requires X-Tenant and rejects unknown schools', async () => {
    const missing = await ctx.api(undefined, '').get('/api/institution/branding');
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe('TENANT_REQUIRED');
    const unknown = await ctx.api(undefined, 'no-existe').get('/api/institution/branding');
    expect(unknown.status).toBe(404);
  });

  describe('managed account lifecycle', () => {
    let userId: number;
    let email: string;
    let temporaryPassword: string;
    let token: string;

    it('creates the account storing the e-mail in lower case', async () => {
      email = `E2E.Profe.${uniqueSuffix()}@Demo.CO`;
      const res = await ctx.api(director).post('/api/users').send({ name: 'Profe E2E', email, role: 'teacher' });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email.toLowerCase());
      expect(res.body.user.mustChangePassword).toBe(true);
      userId = res.body.user.id;
      temporaryPassword = res.body.temporaryPassword;

      const duplicate = await ctx
        .api(director)
        .post('/api/users')
        .send({ name: 'Otro', email: email.toUpperCase(), role: 'teacher' });
      expect(duplicate.status).toBe(409);
    });

    it('forces the password change before any other endpoint', async () => {
      const login = await ctx.api().post('/api/auth/login').send({ email, password: temporaryPassword });
      expect(login.status).toBe(200);
      expect(login.body.user.mustChangePassword).toBe(true);
      token = login.body.accessToken;

      const blocked = await ctx.api(token).get('/api/notifications');
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      expect((await ctx.api(token).get('/api/auth/me')).status).toBe(200);

      const weak = await ctx
        .api(token)
        .patch('/api/auth/password')
        .send({ currentPassword: temporaryPassword, newPassword: 'corta' });
      expect(weak.status).toBe(422);
      const changed = await ctx
        .api(token)
        .patch('/api/auth/password')
        .send({ currentPassword: temporaryPassword, newPassword: NEW_PASSWORD });
      expect(changed.status).toBe(204);
      expect((await ctx.api(token).get('/api/notifications')).status).toBe(200);
    });

    it('answers 403 to a role without permission and audits it with allowed = false', async () => {
      const res = await ctx.api(token).get('/api/users?page=1');
      expect(res.status).toBe(403);

      const denied = await eventually(async () => {
        const log = await ctx.api(director).get(`/api/audit/access-log?userId=${userId}&allowed=false`);
        expect(log.status).toBe(200);
        return log.body.items.find((item: { path: string }) => item.path === 'GET /api/users');
      });
      expect(denied).toMatchObject({ allowed: false, role: 'teacher', module: 'users', userId });
      // Day filter uses Bogotá dates: the record is "today" there.
      expect(bogotaDateOf(denied.createdAt)).toBe(todayInBogota());
      const today = todayInBogota();
      const filtered = await ctx
        .api(director)
        .get(`/api/audit/access-log?userId=${userId}&allowed=false&from=${today}&to=${today}`);
      expect(filtered.body.total).toBeGreaterThanOrEqual(1);

      const row = await withTenantDb((db) =>
        db.query('SELECT allowed FROM access_log WHERE user_id = $1 AND path = $2', [userId, 'GET /api/users']),
      );
      expect(row.rows[0].allowed).toBe(false);
    });

    it('audits the logout', async () => {
      const res = await ctx.api(token).post('/api/auth/logout');
      expect(res.status).toBe(204);
      const logout = await withTenantDb((db) =>
        db.query("SELECT allowed FROM access_log WHERE user_id = $1 AND path = '/auth/logout'", [userId]),
      );
      expect(logout.rows).toEqual([{ allowed: true }]);
    });

    it('revokes access immediately when the account is deactivated', async () => {
      const off = await ctx.api(director).patch(`/api/users/${userId}/status`).send({ active: false });
      expect(off.status).toBe(200);

      const withOldToken = await ctx.api(token).get('/api/auth/me');
      expect(withOldToken.status).toBe(401);
      const login = await ctx.api().post('/api/auth/login').send({ email, password: NEW_PASSWORD });
      expect(login.status).toBe(401);

      const failed = await withTenantDb((db) =>
        db.query(
          "SELECT count(*)::int AS n FROM access_log WHERE user_id = $1 AND path = '/auth/login' AND allowed = false",
          [userId],
        ),
      );
      expect(failed.rows[0].n).toBeGreaterThanOrEqual(1);
    });
  });
});
