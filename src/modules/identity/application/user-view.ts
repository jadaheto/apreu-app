import { portalForRole, type Portal, type Role } from '../../../shared/domain/role.js';
import type { User } from '../domain/user.js';

/** Read model of a user returned by the application layer (no password hash). */
export interface UserView {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  portal: Portal;
  /** The frontend must force a password change before anything else. */
  mustChangePassword: boolean;
}

export const toUserView = (user: User): UserView => ({
  id: user.id as number,
  name: user.name,
  email: user.email.toString(),
  role: user.role,
  avatar: user.avatar,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  portal: portalForRole(user.role),
  mustChangePassword: user.mustChangePassword,
});
