import { loadEnvironment } from './environment.js';

const base = {
  JWT_SECRET: 'secret',
  TENANT_DB_HOST: 'db',
  TENANT_DB_USER: 'apreu',
  TENANT_DB_PASSWORD: 'pw',
  MASTER_DB_NAME: 'apreu_master',
};

describe('loadEnvironment', () => {
  it('applies defaults and reuses tenant credentials for the master database', () => {
    const env = loadEnvironment(base);

    expect(env.port).toBe(3000);
    expect(env.jwt.expiresIn).toBe('8h');
    expect(env.masterDb).toEqual({
      host: 'db',
      port: 5432,
      username: 'apreu',
      password: 'pw',
      database: 'apreu_master',
    });
    expect(env.tenantDb.databasePrefix).toBe('apreu_');
    expect(env.defaultTenant).toBeNull();
  });

  it('reads optional storage, QR and e-invoicing settings', () => {
    const env = loadEnvironment({
      ...base,
      UPLOADS_DIR: '/data/up',
      STUDENT_QR_SECRET: ' qr ',
      E_INVOICING_CERTS_DIR: '',
    });
    expect(env.storage.uploadsDir).toBe('/data/up');
    expect(env.studentQrSecret).toBe('qr');
    expect(env.eInvoicing).toEqual({ certsDir: null, secretKey: null });
  });

  it('reads the tenant status TTL and the internal API token', () => {
    expect(loadEnvironment(base)).toMatchObject({
      tenantStatusTtlSeconds: 5,
      tenantPoolIdleMinutes: 30,
      internalApiToken: null,
    });
    expect(loadEnvironment({ ...base, TENANT_POOL_IDLE_MINUTES: '0' }).tenantPoolIdleMinutes).toBe(0);
    expect(loadEnvironment({ ...base, TENANT_STATUS_TTL_SECONDS: '0', INTERNAL_API_TOKEN: ' tok ' })).toMatchObject({
      tenantStatusTtlSeconds: 0,
      internalApiToken: 'tok',
    });
    expect(() =>
      loadEnvironment({ ...base, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), INTERNAL_API_TOKEN: 'short' }),
    ).toThrow(/INTERNAL_API_TOKEN/);
  });

  it('parses the CORS whitelist', () => {
    const env = loadEnvironment({ ...base, CORS_ORIGINS: 'http://a.co, http://b.co' });
    expect(env.corsOrigins).toEqual(['http://a.co', 'http://b.co']);
  });

  it('reads TRUST_PROXY as a proxy count or an address list', () => {
    expect(loadEnvironment(base).trustProxy).toBe(false);
    expect(loadEnvironment({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadEnvironment({ ...base, TRUST_PROXY: 'loopback, 10.0.0.0/8' }).trustProxy).toBe('loopback, 10.0.0.0/8');
    expect(() => loadEnvironment({ ...base, TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  it('fails when a required variable is missing', () => {
    expect(() => loadEnvironment({ ...base, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('requires a long JWT secret in production', () => {
    expect(() => loadEnvironment({ ...base, NODE_ENV: 'production' })).toThrow(/32 caracteres/);
  });

  it('rejects non numeric ports', () => {
    expect(() => loadEnvironment({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
