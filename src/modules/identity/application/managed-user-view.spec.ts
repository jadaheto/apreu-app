import { Role } from '../../../shared/domain/role.js';
import { User } from '../domain/user.js';
import { toManagedUserView } from './managed-user-view.js';

const user = (role: Role, active = true) => {
  const created = User.create({ name: 'U', email: 'u@c.co', passwordHash: 'h', role });
  created.assignId(3);
  if (!active) created.deactivate();
  return created;
};

describe('toManagedUserView', () => {
  it.each([
    [Role.TEACHER, true, 'on_leave', 'on_leave'],
    [Role.EMPLOYEE, true, 'retired', 'retired'],
    [Role.EMPLOYEE, true, null, 'active'],
    [Role.TEACHER, false, 'active', 'inactive'],
    [Role.ADMIN, true, 'suspended', 'active'],
    [Role.PARENT, false, null, 'inactive'],
  ])('%s active=%s employment=%s → %s', (role, active, employment, expected) => {
    expect(toManagedUserView(user(role, active), employment).effectiveStatus).toBe(expected);
  });

  it('only exposes the employment status of staff roles', () => {
    expect(toManagedUserView(user(Role.ADMIN), 'active').employmentStatus).toBeNull();
  });
});
