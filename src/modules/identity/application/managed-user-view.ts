import type { Role } from '../../../shared/domain/role.js';
import type { EmploymentStatus } from '../domain/employment-status.port.js';
import { EMPLOYMENT_CHECKED_ROLES } from '../domain/employment-status.port.js';
import type { User } from '../domain/user.js';

/**
 * Status shown in the user administration screen. A disabled account is
 * always `inactive`; otherwise teachers/employees show the status of their
 * linked employee record and everyone else `active` (legacy rule 10, without
 * the duplicate rows and name heuristics of `admin/users.php`, bug B21).
 */
export type EffectiveUserStatus = 'active' | 'inactive' | 'suspended' | 'retired' | 'on_leave';

/** User as seen by an administrator. */
export interface ManagedUserView {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: Date | null;
  createdAt: Date | null;
  employmentStatus: EmploymentStatus | null;
  effectiveStatus: EffectiveUserStatus;
}

const EMPLOYMENT_TO_EFFECTIVE: Record<string, EffectiveUserStatus> = {
  active: 'active',
  on_leave: 'on_leave',
  suspended: 'suspended',
  retired: 'retired',
  inactive: 'inactive',
};

export const toManagedUserView = (user: User, employmentStatus: EmploymentStatus | null = null): ManagedUserView => {
  const linkedStatus = EMPLOYMENT_CHECKED_ROLES.includes(user.role) ? employmentStatus : null;
  return {
    id: user.id as number,
    name: user.name,
    email: user.email.toString(),
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    employmentStatus: linkedStatus,
    effectiveStatus: !user.isActive ? 'inactive' : (EMPLOYMENT_TO_EFFECTIVE[linkedStatus ?? 'active'] ?? 'inactive'),
  };
};

/** A user created or reset by an administrator plus the one-time temporary password. */
export interface UserWithTemporaryPassword {
  user: ManagedUserView;
  /** Shown once to the administrator; it is never stored in clear text. */
  temporaryPassword: string;
}
