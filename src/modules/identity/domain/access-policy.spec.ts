import { Role } from '../../../shared/domain/role.js';
import { AccessPolicy, NAVIGATION, Permission } from './access-policy.js';

const keys = (role: Role, disabled = new Set<'payroll' | 'accounting'>()) =>
  AccessPolicy.modulesFor(role, disabled).map((module) => module.key);

describe('AccessPolicy', () => {
  it('grants every permission to the superadmin', () => {
    expect(AccessPolicy.permissionsFor(Role.SUPERADMIN)).toEqual(Object.values(Permission));
  });

  it.each([
    [Role.ADMIN, Permission.USERS_MANAGE, true],
    [Role.ADMIN, Permission.AI_LOGS_ALL, false],
    [Role.FINANCE, Permission.DASHBOARD_VIEW, true],
    [Role.HR, Permission.DASHBOARD_VIEW, true],
    [Role.FINANCE, Permission.USERS_READ, false],
    [Role.FINANCE, Permission.SETTINGS_DIAN, true],
    [Role.HR, Permission.SETTINGS_PAYROLL, true],
    [Role.HR, Permission.SETTINGS_DIAN, false],
    [Role.TEACHER, Permission.STICKERS_OWN, true],
    [Role.STUDENT, Permission.STICKERS_OWN, false],
    [Role.PARENT, Permission.BRANDING_READ, true],
  ])('%s → %s = %s', (role, permission, expected) => {
    expect(AccessPolicy.can(role, permission)).toBe(expected);
  });

  it('lets finance and hr land on the dashboard (legacy bug B1)', () => {
    expect(keys(Role.FINANCE)).toContain('dashboard');
    expect(keys(Role.HR)).toContain('dashboard');
  });

  it('only lists modules the role can open (legacy bug B18)', () => {
    expect(keys(Role.FINANCE)).not.toContain('users');
    expect(keys(Role.HR)).not.toContain('accounting');
    expect(keys(Role.TEACHER)).not.toContain('marketing-ai');
    expect(keys(Role.PARENT)).not.toContain('attendance');
    expect(keys(Role.STUDENT)).toContain('attendance');
  });

  it('shows the admin menu plus superadmin-only modules to the superadmin, not the portals', () => {
    const modules = keys(Role.SUPERADMIN);
    expect(modules).toContain('ai-logs');
    expect(modules).toContain('users');
    expect(modules).not.toContain('student-home');
    expect(keys(Role.ADMIN)).not.toContain('ai-logs');
  });

  it('hides modules disabled by the school (legacy bug B5)', () => {
    expect(keys(Role.ADMIN, new Set(['payroll']))).not.toContain('payroll');
    expect(keys(Role.ADMIN, new Set(['accounting']))).not.toContain('accounting');
    expect(keys(Role.ADMIN)).toEqual(expect.arrayContaining(['payroll', 'accounting']));
  });

  it('uses unique module keys', () => {
    const all = NAVIGATION.map((module) => module.key);
    expect(new Set(all).size).toBe(all.length);
  });
});
