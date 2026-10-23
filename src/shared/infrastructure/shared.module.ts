import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CLOCK } from '../application/ports/clock.port.js';
import { EVENT_BUS } from '../application/ports/event-bus.port.js';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port.js';
import { UNIT_OF_WORK } from '../application/ports/unit-of-work.port.js';
import { ENVIRONMENT, type Environment, loadEnvironment } from './config/environment.js';
import { DocumentBrandingProvider } from './documents/document-branding.js';
import { InProcessEventBus } from './events/in-process-event-bus.js';
import { JwtAuthGuard } from './http/guards/jwt-auth.guard.js';
import { RolesGuard } from './http/guards/roles.guard.js';
import { TenantConnectionManager } from './persistence/tenant-connection-manager.js';
import { TenantDataSource } from './persistence/tenant-data-source.js';
import { BackgroundTasks } from './runtime/background-tasks.js';
import { BcryptPasswordHasher } from './security/password-hasher.js';
import { InternalTenantsController } from './tenancy/internal-tenants.controller.js';
import { TenantContext } from './tenancy/tenant-context.js';
import { MasterTenantLookup, TENANT_LOOKUP } from './tenancy/tenant-registry.js';
import { TenantResolver } from './tenancy/tenant-resolver.js';
import { TENANTLESS_ROUTES } from './tenancy/tenantless-routes.js';
import { TenantMiddleware } from './tenancy/tenant.middleware.js';
import { SystemClock } from './time/system-clock.js';

/**
 * Cross-cutting infrastructure shared by every bounded context: configuration,
 * multi-tenancy, persistence, security and the global guards.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ENVIRONMENT],
      useFactory: (env: Environment) => ({
        secret: env.jwt.secret,
        signOptions: { expiresIn: env.jwt.expiresIn as any },
      }),
      extraProviders: [{ provide: ENVIRONMENT, useFactory: () => loadEnvironment() }],
    }),
  ],
  controllers: [InternalTenantsController],
  providers: [
    { provide: ENVIRONMENT, useFactory: () => loadEnvironment() },
    { provide: CLOCK, useClass: SystemClock },
    { provide: EVENT_BUS, useClass: InProcessEventBus },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TENANT_LOOKUP, useClass: MasterTenantLookup },
    BackgroundTasks,
    TenantContext,
    TenantResolver,
    TenantConnectionManager,
    TenantDataSource,
    DocumentBrandingProvider,
    { provide: UNIT_OF_WORK, useExisting: TenantDataSource },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [
    ENVIRONMENT,
    BackgroundTasks,
    CLOCK,
    EVENT_BUS,
    PASSWORD_HASHER,
    UNIT_OF_WORK,
    TenantContext,
    TenantDataSource,
    DocumentBrandingProvider,
    JwtModule,
  ],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(...TENANTLESS_ROUTES)
      .forRoutes('{*path}');
  }
}
