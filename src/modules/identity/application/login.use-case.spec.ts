import { ForbiddenError, UnauthorizedError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakePasswordHasher, FixedClock } from '../../../shared/testing/fakes.js';
import type { EmploymentStatusPort } from '../domain/employment-status.port.js';
import { User } from '../domain/user.js';
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js';
import type { AccessLogEntry, AccessLogPort } from './ports/access-log.port.js';
import type { TokenIssuerPort } from './ports/token-issuer.port.js';
import { LoginUseCase } from './login.use-case.js';

describe('LoginUseCase', () => {
  let users: InMemoryUserRepository;
  let employmentStatus: string | null;
  let audit: AccessLogEntry[];
  let clock: FixedClock;
  let useCase: LoginUseCase;
  const tokens: TokenIssuerPort = { issue: vi.fn(async () => ({ accessToken: 'jwt', expiresIn: 28800 })) };

  const addUser = async (role = Role.ADMIN, active = true) => {
    const user = User.create({ name: 'Director', email: 'dir@colegio.co', passwordHash: 'hashed:Clave123', role });
    if (!active) user.deactivate();
    await users.save(user);
    return user;
  };

  const login = (password = 'Clave123', email = 'DIR@colegio.co ') =>
    useCase.execute({ email, password, tenant: 'colegio-a', ipAddress: '1.2.3.4' });

  beforeEach(() => {
    users = new InMemoryUserRepository();
    employmentStatus = null;
    audit = [];
    clock = new FixedClock();
    const employment: EmploymentStatusPort = { statusFor: async () => employmentStatus };
    const accessLog: AccessLogPort = { record: async (entry) => void audit.push(entry) };
    useCase = new LoginUseCase(users, new FakePasswordHasher(), employment, tokens, accessLog, clock);
  });

  it('returns a token and the user profile with its portal', async () => {
    await addUser(Role.FINANCE);

    const result = await login();

    expect(result.accessToken).toBe('jwt');
    expect(result.user).toMatchObject({ email: 'dir@colegio.co', role: Role.FINANCE, portal: 'admin' });
    expect(tokens.issue).toHaveBeenCalledWith(expect.objectContaining({ tenant: 'colegio-a', role: Role.FINANCE }));
  });

  it('updates last login and audits the success', async () => {
    const user = await addUser();
    await login();
    expect(user.lastLogin).toEqual(clock.now());
    expect(audit).toEqual([expect.objectContaining({ userId: user.id, allowed: true, ipAddress: '1.2.3.4' })]);
  });

  it.each([
    ['wrong password', () => login('otra')],
    ['unknown e-mail', () => login('Clave123', 'nadie@colegio.co')],
  ])('fails with a generic message for %s', async (_case, attempt) => {
    await addUser();
    await expect(attempt()).rejects.toThrow(new UnauthorizedError('Correo o contraseña incorrectos.'));
    expect(audit[0]?.allowed).toBe(false);
  });

  it('rejects inactive users', async () => {
    await addUser(Role.ADMIN, false);
    await expect(login()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each(['inactive', 'terminated'])('blocks teachers whose employee status is %s', async (status) => {
    await addUser(Role.TEACHER);
    employmentStatus = status;
    await expect(login()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each(['active', 'on_leave', null])('allows employees with status %s', async (status) => {
    await addUser(Role.EMPLOYEE);
    employmentStatus = status;
    await expect(login()).resolves.toMatchObject({ user: { portal: 'employee' } });
  });

  it('does not check employment for non staff roles', async () => {
    await addUser(Role.PARENT);
    employmentStatus = 'terminated';
    await expect(login()).resolves.toMatchObject({ user: { portal: 'student' } });
  });
});
