import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../http/decorators/public.decorator.js';
import { InternalTokenGuard } from '../http/guards/internal-token.guard.js';
import { ENVIRONMENT } from '../config/environment.js';
import { InternalTenantsController } from './internal-tenants.controller.js';
import { TenantResolver } from './tenant-resolver.js';

const contextWith = (headers: Record<string, string | string[]>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

describe('InternalTokenGuard', () => {
  const guard = (token: string | null) => new InternalTokenGuard({ internalApiToken: token });

  it('accepts the shared secret', () => {
    expect(guard('s3cret').canActivate(contextWith({ 'x-internal-token': 's3cret' }))).toBe(true);
    expect(guard('s3cret').canActivate(contextWith({ 'x-internal-token': ['s3cret'] }))).toBe(true);
  });

  it('rejects a missing or wrong token', () => {
    expect(() => guard('s3cret').canActivate(contextWith({}))).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
    expect(() => guard('s3cret').canActivate(contextWith({ 'x-internal-token': 's3cre' }))).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('disables the internal API when no token is configured', () => {
    expect(() => guard(null).canActivate(contextWith({ 'x-internal-token': '' }))).toThrow(
      expect.objectContaining({ code: 'INTERNAL_API_DISABLED' }),
    );
  });
});

describe('InternalTenantsController', () => {
  it('is public (no JWT), protected by the internal token and invalidates the cache', async () => {
    const resolver = { invalidate: vi.fn().mockReturnValue(true) };
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalTenantsController],
      providers: [
        { provide: TenantResolver, useValue: resolver },
        { provide: ENVIRONMENT, useValue: { internalApiToken: 'x' } },
      ],
    }).compile();
    const controller = moduleRef.get(InternalTenantsController);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, InternalTenantsController)).toBe(true);
    expect(Reflect.getMetadata('__guards__', InternalTenantsController)).toEqual([InternalTokenGuard]);
    controller.invalidate('colegio-a');
    expect(resolver.invalidate).toHaveBeenCalledWith('colegio-a');
  });
});
