import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenError, UnauthorizedError } from '../../../domain/domain-error.js';
import { Role } from '../../../domain/role.js';
import { TenantContext } from '../../tenancy/tenant-context.js';
import type { Tenant } from '../../tenancy/tenant.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

const tenantA: Tenant = { id: 1, slug: 'a', name: 'A', status: 'active', databaseName: 'apreu_a' };

const contextFor = (request: Record<string, any>): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const reflectorReturning = (value: unknown): Reflector =>
  ({ getAllAndOverride: vi.fn().mockReturnValue(value) }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const tenantContext = new TenantContext();
  const sign = (tenant = 'a') => jwt.sign({ sub: 7, role: Role.ADMIN, email: 'd@c.co', name: 'Director', tenant });

  it('lets public endpoints through', async () => {
    const guard = new JwtAuthGuard(reflectorReturning(true), jwt, tenantContext);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });

  it('rejects requests without a bearer token', async () => {
    const guard = new JwtAuthGuard(reflectorReturning(false), jwt, tenantContext);
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects invalid tokens', async () => {
    const guard = new JwtAuthGuard(reflectorReturning(false), jwt, tenantContext);
    const request = { headers: { authorization: 'Bearer basura' } };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('attaches the actor for a valid token of the current tenant', async () => {
    const guard = new JwtAuthGuard(reflectorReturning(false), jwt, tenantContext);
    const request: Record<string, any> = { headers: { authorization: `Bearer ${sign()}` } };

    await tenantContext.run(tenantA, () => guard.canActivate(contextFor(request)));

    expect(request.actor).toEqual({ userId: 7, role: Role.ADMIN, email: 'd@c.co', name: 'Director', tenant: 'a' });
  });

  it('rejects tokens issued by another school', async () => {
    const guard = new JwtAuthGuard(reflectorReturning(false), jwt, tenantContext);
    const request = { headers: { authorization: `Bearer ${sign('b')}` } };
    await expect(tenantContext.run(tenantA, () => guard.canActivate(contextFor(request)))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('RolesGuard', () => {
  const actor = (role: Role) => ({ actor: { role } });

  it('allows endpoints without role restrictions', () => {
    expect(new RolesGuard(reflectorReturning(undefined)).canActivate(contextFor(actor(Role.STUDENT)))).toBe(true);
  });

  it('allows actors with a required role', () => {
    const guard = new RolesGuard(reflectorReturning([Role.FINANCE, Role.ADMIN]));
    expect(guard.canActivate(contextFor(actor(Role.FINANCE)))).toBe(true);
  });

  it('always allows superadmin', () => {
    const guard = new RolesGuard(reflectorReturning([Role.HR]));
    expect(guard.canActivate(contextFor(actor(Role.SUPERADMIN)))).toBe(true);
  });

  it('forbids other roles', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(() => guard.canActivate(contextFor(actor(Role.TEACHER)))).toThrow(ForbiddenError);
  });
});
