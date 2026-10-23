import { Inject, Injectable } from '@nestjs/common';
import { portalForRole, type Portal, type Role } from '../../../shared/domain/role.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { AccessPolicy, type NavigationModule, type Permission } from '../domain/access-policy.js';
import { MODULE_TOGGLES, type ModuleTogglesPort } from '../domain/module-toggles.port.js';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '../domain/session-policy.js';

/** Menu entry sent to the frontend. */
export type NavigationItem = Omit<NavigationModule, 'roles' | 'toggle'>;

/** Everything the frontend needs to build the shell for the signed-in user. */
export interface MyPermissionsView {
  role: Role;
  portal: Portal;
  permissions: Permission[];
  modules: NavigationItem[];
  session: { idleTimeoutSeconds: number };
}

/**
 * Returns the permissions and accessible modules of the current role so the
 * frontend builds the menu from the same matrix the API enforces (legacy
 * sidebar listed modules that answered 403, bug B18, and ignored the
 * `module_payroll` / `module_accounting` switches, bug B5).
 */
@Injectable()
export class GetMyPermissionsUseCase implements UseCase<Role, MyPermissionsView> {
  constructor(@Inject(MODULE_TOGGLES) private readonly toggles: ModuleTogglesPort) {}

  async execute(role: Role): Promise<MyPermissionsView> {
    const disabled = await this.toggles.disabledModules();
    return {
      role,
      portal: portalForRole(role),
      permissions: AccessPolicy.permissionsFor(role),
      modules: AccessPolicy.modulesFor(role, disabled).map(({ key, label, route, icon }) => ({
        key,
        label,
        route,
        icon,
      })),
      session: { idleTimeoutSeconds: SESSION_IDLE_TIMEOUT_SECONDS },
    };
  }
}
