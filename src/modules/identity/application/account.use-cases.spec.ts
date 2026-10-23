import { NotFoundError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakePasswordHasher } from '../../../shared/testing/fakes.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js';
import { ChangePasswordUseCase } from './change-password.use-case.js';
import { GetCurrentUserUseCase } from './get-current-user.use-case.js';

describe('account use cases', () => {
  let users: InMemoryUserRepository;
  let user: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    user = User.create({ name: 'Profe', email: 'p@c.co', passwordHash: 'hashed:Actual123', role: Role.TEACHER });
    await users.save(user);
  });

  describe('GetCurrentUserUseCase', () => {
    it('returns the profile without the password hash', async () => {
      const view = await new GetCurrentUserUseCase(users).execute(user.id as number);
      expect(view).toMatchObject({ id: user.id, name: 'Profe', portal: 'employee' });
      expect(view).not.toHaveProperty('passwordHash');
    });

    it('fails for unknown or disabled users', async () => {
      const useCase = new GetCurrentUserUseCase(users);
      await expect(useCase.execute(999)).rejects.toBeInstanceOf(NotFoundError);
      user.deactivate();
      await expect(useCase.execute(user.id as number)).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('ChangePasswordUseCase', () => {
    const change = (currentPassword: string, newPassword: string, userId = user.id as number) =>
      new ChangePasswordUseCase(users, new FakePasswordHasher()).execute({ userId, currentPassword, newPassword });

    it('stores the new hash', async () => {
      await change('Actual123', 'Nueva2026');
      expect(user.passwordHash).toBe('hashed:Nueva2026');
    });

    it.each([
      ['Mala123', 'Nueva2026', 'WRONG_PASSWORD'],
      ['Actual123', 'Actual123', 'SAME_PASSWORD'],
      ['Actual123', 'debil', 'WEAK_PASSWORD'],
    ])('rejects current=%s new=%s', async (current, next, code) => {
      await expect(change(current, next)).rejects.toMatchObject({ code });
    });

    it('fails for unknown users', async () => {
      await expect(change('a', 'b', 404)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
