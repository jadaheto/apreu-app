import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { User } from './user.js';
import { UserAdministrationPolicy as Policy } from './user-administration-policy.js';

const user = (id: number, role: Role) => {
  const created = User.create({ name: 'U', email: `u${id}@c.co`, passwordHash: 'h', role });
  created.assignId(id);
  return created;
};

describe('UserAdministrationPolicy', () => {
  const admin = { userId: 1, role: Role.ADMIN };
  const superadmin = { userId: 2, role: Role.SUPERADMIN };

  it('only lets a superadmin assign the superadmin role', () => {
    expect(() => Policy.assertCanAssignRole(admin, Role.SUPERADMIN)).toThrow(ForbiddenError);
    expect(() => Policy.assertCanAssignRole(superadmin, Role.SUPERADMIN)).not.toThrow();
    expect(() => Policy.assertCanAssignRole(admin, Role.ADMIN)).not.toThrow();
  });

  it('only lets a superadmin manage superadmin accounts', () => {
    expect(() => Policy.assertCanManage(admin, user(9, Role.SUPERADMIN))).toThrow(ForbiddenError);
    expect(() => Policy.assertCanManage(superadmin, user(9, Role.SUPERADMIN))).not.toThrow();
    expect(() => Policy.assertCanManage(admin, user(9, Role.TEACHER))).not.toThrow();
  });

  it('forbids changing the own role but allows keeping it', () => {
    const self = user(1, Role.ADMIN);
    expect(() => Policy.assertCanChangeRole(admin, self, Role.TEACHER)).toThrow(
      expect.objectContaining({ code: 'SELF_ROLE_CHANGE' }),
    );
    expect(() => Policy.assertCanChangeRole(admin, self, Role.SUPERADMIN)).toThrow(
      expect.objectContaining({ code: 'SELF_ROLE_CHANGE' }),
    );
    expect(() => Policy.assertCanChangeRole(admin, self, Role.ADMIN)).not.toThrow();
    expect(() => Policy.assertCanChangeRole(admin, user(5, Role.TEACHER), Role.SUPERADMIN)).toThrow(ForbiddenError);
  });

  it('forbids deactivating oneself', () => {
    expect(() => Policy.assertCanChangeStatus(admin, user(1, Role.ADMIN), false)).toThrow(
      expect.objectContaining({ code: 'SELF_DEACTIVATION' }),
    );
    expect(() => Policy.assertCanChangeStatus(admin, user(1, Role.ADMIN), true)).not.toThrow();
    expect(() => Policy.assertCanChangeStatus(admin, user(5, Role.HR), false)).not.toThrow();
  });

  it('forbids resetting the own password through administration', () => {
    expect(() => Policy.assertCanResetPassword(admin, user(1, Role.ADMIN))).toThrow(
      expect.objectContaining({ code: 'SELF_PASSWORD_RESET' }),
    );
  });
});
