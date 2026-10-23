import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLOCK } from '../application/ports/clock.port.js';
import { EVENT_BUS } from '../application/ports/event-bus.port.js';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port.js';
import { UNIT_OF_WORK } from '../application/ports/unit-of-work.port.js';
import { ENVIRONMENT, type Environment } from '../infrastructure/config/environment.js';
import { DocumentBrandingProvider } from '../infrastructure/documents/document-branding.js';
import { TenantDataSource } from '../infrastructure/persistence/tenant-data-source.js';
import { TenantContext } from '../infrastructure/tenancy/tenant-context.js';
import { FakePasswordHasher, FakeUnitOfWork, FixedClock, RecordingEventBus } from './fakes.js';

/** Environment used by wiring tests: no real database, temp upload folder. */
export const TEST_ENVIRONMENT: Environment = {
  nodeEnv: 'test',
  port: 0,
  corsOrigins: [],
  trustProxy: false,
  jwt: { secret: 'test-secret', expiresIn: '1h' },
  masterDb: { host: 'localhost', port: 5432, username: 'test', password: '', database: 'test' },
  tenantDb: { host: 'localhost', port: 5432, username: 'test', password: '', databasePrefix: 'apreu_' },
  defaultTenant: null,
  tenantCacheTtlSeconds: 60,
  tenantStatusTtlSeconds: 5,
  tenantPoolIdleMinutes: 30,
  internalApiToken: null,
  storage: { uploadsDir: join(tmpdir(), 'apreu-test-uploads') },
  studentQrSecret: null,
  documentVerifyUrlTemplate: null,
  eInvoicing: { certsDir: null, secretKey: null },
};

/**
 * Global stand-in for `SharedModule` (no database) used to verify that a
 * bounded-context module resolves all of its providers. Pass a custom event
 * bus to assert subscriptions.
 */
export const createKernelStubModule = (eventBus: unknown = new RecordingEventBus()) => {
  @Global()
  @Module({
    imports: [JwtModule.register({ global: true, secret: TEST_ENVIRONMENT.jwt.secret })],
    providers: [
      { provide: ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: CLOCK, useValue: new FixedClock() },
      { provide: EVENT_BUS, useValue: eventBus },
      { provide: PASSWORD_HASHER, useValue: new FakePasswordHasher() },
      { provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork() },
      { provide: TenantDataSource, useValue: {} },
      TenantContext,
      DocumentBrandingProvider,
    ],
    exports: [
      ENVIRONMENT,
      CLOCK,
      EVENT_BUS,
      PASSWORD_HASHER,
      UNIT_OF_WORK,
      TenantDataSource,
      TenantContext,
      DocumentBrandingProvider,
    ],
  })
  class KernelStubModule {}
  return KernelStubModule;
};

export const KernelStubModule = createKernelStubModule();
