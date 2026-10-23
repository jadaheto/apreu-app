import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../../../../../shared/domain/domain-error.js';
import { Role } from '../../../../../shared/domain/role.js';
import { User } from '../../../domain/user.js';
import { InMemoryUserRepository } from '../../../testing/in-memory-user.repository.js';
import { ActiveSessionGuard } from './active-session.guard.js';

describe('ActiveSessionGuard', () => {
  let users: InMemoryUserRepository;
  let user: User;
  const reflector = (allowPending: boolean) => ({ getAllAndOverride: () => allowPending }) as unknown as Reflector;
  const contextFor = (actor?: { userId: number }) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ actor }) }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    user = User.create({ name: 'Ana', email: 'ana@c.co', passwordHash: 'h', role: Role.ADMIN });
    await users.save(user);
  });

  it('ignores public endpoints', async () => {
    await expect(new ActiveSessionGuard(reflector(false), users).canActivate(contextFor())).resolves.toBe(true);
  });

  it('allows active users', async () => {
    const guard = new ActiveSessionGuard(reflector(false), users);
    await expect(guard.canActivate(contextFor({ userId: user.id as number }))).resolves.toBe(true);
  });

  it('revokes access of deactivated or deleted users', async () => {
    const guard = new ActiveSessionGuard(reflector(false), users);
    user.deactivate();
    await expect(guard.canActivate(contextFor({ userId: user.id as number }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(guard.canActivate(contextFor({ userId: 999 }))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('restricts users with a temporary password to whitelisted endpoints', async () => {
    const created = User.create({
      name: 'Nuevo',
      email: 'n@c.co',
      passwordHash: 'h',
      role: Role.TEACHER,
      mustChangePassword: true,
    });
    await users.save(created);
    const actor = { userId: created.id as number };

    await expect(new ActiveSessionGuard(reflector(false), users).canActivate(contextFor(actor))).rejects.toEqual(
      expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }),
    );
    await expect(new ActiveSessionGuard(reflector(true), users).canActivate(contextFor(actor))).resolves.toBe(true);
    expect(ForbiddenError).toBeDefined();
  });
});
