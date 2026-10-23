import { BusinessRuleViolationError, ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import type { User } from './user.js';

/** The administrator performing a user-management operation. */
export interface UserAdministrator {
  userId: number;
  role: Role;
}

/**
 * Anti privilege-escalation rules for user management (fixes legacy
 * `admin/users.php` S10, where an admin could promote anyone — including
 * themselves — to superadmin and reset a superadmin's password).
 *
 * 1. Only a superadmin may assign the `superadmin` role.
 * 2. Only a superadmin may modify, reset or (de)activate a superadmin account.
 * 3. Nobody may change their own role (an admin cannot demote or promote themselves).
 * 4. Nobody may deactivate their own account.
 * 5. Administrators reset other users' passwords; their own is changed with
 *    `PATCH /auth/password` (which requires the current password).
 */
export const UserAdministrationPolicy = {
  assertCanAssignRole(actor: UserAdministrator, role: Role): void {
    if (role === Role.SUPERADMIN && actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenError('Solo un superadministrador puede asignar el rol de superadministrador.');
    }
  },

  assertCanManage(actor: UserAdministrator, target: User): void {
    if (target.role === Role.SUPERADMIN && actor.role !== Role.SUPERADMIN) {
      throw new ForbiddenError('Solo un superadministrador puede modificar la cuenta de otro superadministrador.');
    }
  },

  assertCanChangeRole(actor: UserAdministrator, target: User, role: Role): void {
    if (role === target.role) return;
    if (target.id === actor.userId) {
      throw new BusinessRuleViolationError('No puede cambiar su propio rol.', 'SELF_ROLE_CHANGE');
    }
    UserAdministrationPolicy.assertCanAssignRole(actor, role);
  },

  assertCanChangeStatus(actor: UserAdministrator, target: User, active: boolean): void {
    if (!active && target.id === actor.userId) {
      throw new BusinessRuleViolationError('No puede desactivar su propia cuenta.', 'SELF_DEACTIVATION');
    }
  },

  assertCanResetPassword(actor: UserAdministrator, target: User): void {
    if (target.id === actor.userId) {
      throw new BusinessRuleViolationError(
        'Para cambiar su propia contraseña use la opción "Cambiar contraseña".',
        'SELF_PASSWORD_RESET',
      );
    }
  },
};
