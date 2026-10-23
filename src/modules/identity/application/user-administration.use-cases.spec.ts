import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakePasswordHasher, FixedClock, RecordingEventBus } from '../../../shared/testing/fakes.js';
import { User } from '../domain/user.js';
import { FakeEmploymentDirectory } from '../testing/fake-employment-directory.js';
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js';
import { ChangeUserStatusUseCase } from './change-user-status.use-case.js';
import { CreateUserUseCase } from './create-user.use-case.js';
import { GetUserStatsUseCase } from './get-user-stats.use-case.js';
import { GetUserUseCase } from './get-user.use-case.js';
import { ListUsersUseCase } from './list-users.use-case.js';
import { ManagedUserViewBuilder } from './managed-user-view.builder.js';
import { ResetUserPasswordUseCase } from './reset-user-password.use-case.js';
import { UpdateUserUseCase } from './update-user.use-case.js';

describe('user administration use cases', () => {
  let users: InMemoryUserRepository;
  let employment: FakeEmploymentDirectory;
  let views: ManagedUserViewBuilder;
  let events: RecordingEventBus;
  const clock = new FixedClock();
  const hasher = new FakePasswordHasher();
  const passwords = { generate: () => 'Temporal#2026' };
  const admin = { userId: 1, role: Role.ADMIN };
  const superadmin = { userId: 2, role: Role.SUPERADMIN };

  const add = async (name: string, role: Role, active = true) => {
    const user = User.create({ name, email: `${name.toLowerCase()}@colegio.co`, passwordHash: 'hashed:x', role });
    if (!active) user.deactivate();
    await users.save(user);
    return user;
  };

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    employment = new FakeEmploymentDirectory();
    views = new ManagedUserViewBuilder(employment);
    events = new RecordingEventBus();
    await add('Admin', Role.ADMIN);
    await add('Root', Role.SUPERADMIN);
  });

  describe('CreateUserUseCase', () => {
    const create = (role = Role.TEACHER, actor = admin, email = 'Nuevo@Colegio.co') =>
      new CreateUserUseCase(users, hasher, passwords, events, clock, views).execute({
        actor,
        name: 'Nuevo',
        email,
        role,
      });

    it('creates the user with a hashed temporary password that must be changed', async () => {
      const result = await create();
      const stored = await users.findByEmail('nuevo@colegio.co');
      expect(result.temporaryPassword).toBe('Temporal#2026');
      expect(stored).toMatchObject({ passwordHash: 'hashed:Temporal#2026', mustChangePassword: true, isActive: true });
      expect(result.user).toMatchObject({ email: 'nuevo@colegio.co', role: Role.TEACHER, mustChangePassword: true });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('publishes identity.user-created without the password', async () => {
      const { user } = await create();
      expect(events.published).toEqual([
        {
          name: 'identity.user-created',
          occurredAt: clock.now(),
          payload: { userId: user.id, name: 'Nuevo', email: 'nuevo@colegio.co', role: Role.TEACHER },
        },
      ]);
    });

    it('rejects duplicated e-mails', async () => {
      await expect(create(Role.TEACHER, admin, 'ADMIN@colegio.co')).rejects.toBeInstanceOf(ConflictError);
    });

    it('only lets a superadmin create superadmins', async () => {
      await expect(create(Role.SUPERADMIN)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(create(Role.SUPERADMIN, superadmin)).resolves.toMatchObject({ user: { role: Role.SUPERADMIN } });
    });
  });

  describe('UpdateUserUseCase', () => {
    const update = (input: Partial<{ name: string; email: string; role: Role }>, userId: number, actor = admin) =>
      new UpdateUserUseCase(users, views).execute({ actor, userId, ...input });

    it('updates name, e-mail and role', async () => {
      const target = await add('Profe', Role.TEACHER);
      const view = await update({ name: 'Profe Ana', email: 'ana@colegio.co', role: Role.HR }, target.id as number);
      expect(view).toMatchObject({ name: 'Profe Ana', email: 'ana@colegio.co', role: Role.HR });
    });

    it('rejects an e-mail owned by another user but accepts the own one', async () => {
      const target = await add('Profe', Role.TEACHER);
      await expect(update({ email: 'admin@colegio.co' }, target.id as number)).rejects.toBeInstanceOf(ConflictError);
      await expect(update({ email: 'PROFE@colegio.co' }, target.id as number)).resolves.toBeDefined();
    });

    it('blocks privilege escalation and self role changes', async () => {
      const target = await add('Profe', Role.TEACHER);
      await expect(update({ role: Role.SUPERADMIN }, target.id as number)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(update({ name: 'X' }, 2)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(update({ role: Role.TEACHER }, 1)).rejects.toMatchObject({ code: 'SELF_ROLE_CHANGE' });
      await expect(update({ name: 'Yo mismo' }, 1)).resolves.toMatchObject({ name: 'Yo mismo' });
      await expect(update({ role: Role.SUPERADMIN }, target.id as number, superadmin)).resolves.toMatchObject({
        role: Role.SUPERADMIN,
      });
    });

    it('fails for unknown users', async () => {
      await expect(update({ name: 'X' }, 99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ChangeUserStatusUseCase', () => {
    const change = (userId: number, active: boolean, actor = admin) =>
      new ChangeUserStatusUseCase(users, events, clock, views).execute({ actor, userId, active });

    it('deactivates and reactivates publishing the change once', async () => {
      const target = await add('Profe', Role.TEACHER);
      await expect(change(target.id as number, false)).resolves.toMatchObject({
        isActive: false,
        effectiveStatus: 'inactive',
      });
      await change(target.id as number, false);
      await change(target.id as number, true);
      expect(events.published.map((e) => e.payload)).toEqual([
        { userId: target.id, isActive: false },
        { userId: target.id, isActive: true },
      ]);
    });

    it('forbids self deactivation and touching superadmins as admin', async () => {
      await expect(change(1, false)).rejects.toMatchObject({ code: 'SELF_DEACTIVATION' });
      await expect(change(2, false)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(change(99, false)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('ResetUserPasswordUseCase', () => {
    const reset = (userId: number, actor = admin) =>
      new ResetUserPasswordUseCase(users, hasher, passwords, views).execute({ actor, userId });

    it('assigns a new temporary password', async () => {
      const target = await add('Profe', Role.TEACHER);
      const result = await reset(target.id as number);
      expect(result.temporaryPassword).toBe('Temporal#2026');
      expect(target).toMatchObject({ passwordHash: 'hashed:Temporal#2026', mustChangePassword: true });
    });

    it('protects superadmins and the own account', async () => {
      await expect(reset(2)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(reset(1)).rejects.toMatchObject({ code: 'SELF_PASSWORD_RESET' });
      await expect(reset(99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('queries', () => {
    it('lists users with filters, paging and employment status of staff only', async () => {
      const teacher = await add('Docente', Role.TEACHER);
      await add('Mamá', Role.PARENT, false);
      employment.statuses.set(teacher.id as number, 'suspended');

      const page = await new ListUsersUseCase(users, views).execute({ page: { page: 1, limit: 10 } });
      expect(page.total).toBe(4);
      expect(page.items.find((u) => u.id === teacher.id)).toMatchObject({
        employmentStatus: 'suspended',
        effectiveStatus: 'suspended',
      });
      expect(employment.lookups).toEqual([[{ userId: teacher.id, email: 'docente@colegio.co' }]]);

      const inactive = await new ListUsersUseCase(users, views).execute({
        isActive: false,
        page: { page: 1, limit: 10 },
      });
      expect(inactive.items.map((u) => u.name)).toEqual(['Mamá']);
    });

    it('skips the employment lookup when there are no staff users', async () => {
      await new ListUsersUseCase(users, views).execute({ role: Role.ADMIN, page: { page: 1, limit: 10 } });
      expect(employment.lookups).toEqual([]);
    });

    it('returns a user detail or fails', async () => {
      await expect(new GetUserUseCase(users, views).execute(1)).resolves.toMatchObject({ name: 'Admin' });
      await expect(new GetUserUseCase(users, views).execute(99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('counts users by role family', async () => {
      await add('Docente', Role.TEACHER);
      await add('Contadora', Role.FINANCE);
      await add('Mamá', Role.PARENT, false);
      await expect(new GetUserStatsUseCase(users).execute()).resolves.toEqual({
        total: 5,
        admins: 2,
        staff: 2,
        families: 1,
        inactive: 1,
      });
    });
  });
});
