import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { User } from './user.js';

const valid = { name: '  Ana Pérez ', email: 'ANA@Colegio.edu.co', passwordHash: 'h', role: Role.TEACHER };

describe('User', () => {
  it('creates an active user with normalized name and e-mail', () => {
    const user = User.create(valid);
    expect(user.isNew).toBe(true);
    expect(user.name).toBe('Ana Pérez');
    expect(user.email.toString()).toBe('ana@colegio.edu.co');
    expect(user.isActive).toBe(true);
    expect(user.lastLogin).toBeNull();
  });

  it.each([
    [{ name: ' ' }, 'REQUIRED_FIELD'],
    [{ email: 'no-es-correo' }, 'INVALID_EMAIL'],
    [{ passwordHash: '' }, 'REQUIRED_FIELD'],
    [{ role: 'rector' as Role }, 'INVALID_OPTION'],
    [{ name: 'x'.repeat(151) }, 'MAX_LENGTH'],
  ])('rejects invalid data %o', (override, code) => {
    expect(() => User.create({ ...valid, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('records logins and toggles activation', () => {
    const user = User.create(valid);
    const at = new Date('2026-01-01');
    user.recordLogin(at);
    user.deactivate();
    expect(user.lastLogin).toEqual(at);
    expect(user.isActive).toBe(false);
    user.activate();
    expect(user.isActive).toBe(true);
  });

  it('updates profile data enforcing invariants', () => {
    const user = User.create(valid);
    user.rename('Ana María');
    user.changeEmail('ana.maria@colegio.edu.co');
    user.changeRole(Role.ADMIN);
    user.changeAvatar('a.png');
    user.changePassword('nuevo');
    expect(user).toMatchObject({ name: 'Ana María', role: Role.ADMIN, avatar: 'a.png', passwordHash: 'nuevo' });
    expect(() => user.rename('')).toThrow(BusinessRuleViolationError);
    expect(() => user.changePassword('')).toThrow(BusinessRuleViolationError);
  });

  it('can only receive an id once', () => {
    const user = User.create(valid);
    user.assignId(5);
    expect(() => user.assignId(6)).toThrow();
  });

  it('forces a password change after a temporary password and clears it on change', () => {
    const user = User.create(valid);
    expect(user.mustChangePassword).toBe(false);
    user.assignTemporaryPassword('temp');
    expect(user).toMatchObject({ passwordHash: 'temp', mustChangePassword: true });
    user.changePassword('definitiva');
    expect(user.mustChangePassword).toBe(false);
    expect(() => user.assignTemporaryPassword('')).toThrow(BusinessRuleViolationError);
  });

  it('can be created with a pending password change', () => {
    expect(User.create({ ...valid, mustChangePassword: true }).mustChangePassword).toBe(true);
  });
});
