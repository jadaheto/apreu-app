import { ForbiddenError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js';
import { GetMyPermissionsUseCase } from './get-my-permissions.use-case.js';
import { LogoutUseCase } from './logout.use-case.js';
import type { AccessLogEntry } from './ports/access-log.port.js';
import { RefreshSessionUseCase } from './refresh-session.use-case.js';

describe('session use cases', () => {
  describe('GetMyPermissionsUseCase', () => {
    it('returns portal, permissions, modules without internal fields and the idle timeout', async () => {
      const view = await new GetMyPermissionsUseCase({
        disabledModules: async () => new Set(['accounting'] as const),
      }).execute(Role.FINANCE);
      expect(view).toMatchObject({ role: Role.FINANCE, portal: 'admin', session: { idleTimeoutSeconds: 7200 } });
      expect(view.permissions).toContain('dashboard.admin.view');
      expect(view.modules[0]).toEqual({ key: 'dashboard', label: 'Dashboard', route: '/admin', icon: 'home' });
      expect(view.modules.map((m) => m.key)).not.toContain('accounting');
    });
  });

  describe('RefreshSessionUseCase', () => {
    let users: InMemoryUserRepository;
    let status: string | null;
    const tokens = { issue: vi.fn(async () => ({ accessToken: 'nuevo', expiresIn: 28800 })) };

    const refresh = (userId: number) =>
      new RefreshSessionUseCase(users, { statusFor: async () => status }, tokens).execute({
        userId,
        tenant: 'colegio-a',
      });

    beforeEach(() => {
      users = new InMemoryUserRepository();
      status = null;
      tokens.issue.mockClear();
    });

    const add = async (role: Role, active = true) => {
      const user = User.create({ name: 'Ana', email: 'ana@c.co', passwordHash: 'h', role });
      if (!active) user.deactivate();
      await users.save(user);
      return user;
    };

    it('issues a token with the current role of the user', async () => {
      const user = await add(Role.HR);
      await expect(refresh(user.id as number)).resolves.toEqual({
        accessToken: 'nuevo',
        expiresIn: 28800,
        idleTimeoutSeconds: 7200,
      });
      expect(tokens.issue).toHaveBeenCalledWith({
        userId: user.id,
        role: Role.HR,
        email: 'ana@c.co',
        name: 'Ana',
        tenant: 'colegio-a',
      });
    });

    it('rejects unknown or deactivated users', async () => {
      await expect(refresh(9)).rejects.toBeInstanceOf(UnauthorizedError);
      const user = await add(Role.ADMIN, false);
      await expect(refresh(user.id as number)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects staff whose employment no longer grants access', async () => {
      const user = await add(Role.TEACHER);
      status = 'retired';
      await expect(refresh(user.id as number)).rejects.toBeInstanceOf(ForbiddenError);
      expect(tokens.issue).not.toHaveBeenCalled();
    });
  });

  describe('LogoutUseCase', () => {
    it('audits the sign-out', async () => {
      const entries: AccessLogEntry[] = [];
      await new LogoutUseCase({ record: async (e) => void entries.push(e) }).execute({
        actor: { userId: 4, role: Role.TEACHER, email: 'a@c.co', name: 'A', tenant: 't' },
        ipAddress: '1.1.1.1',
      });
      expect(entries).toEqual([
        { userId: 4, role: Role.TEACHER, path: '/auth/logout', module: 'auth', allowed: true, ipAddress: '1.1.1.1' },
      ]);
    });
  });
});
