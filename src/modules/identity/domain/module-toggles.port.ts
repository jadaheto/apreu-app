/**
 * Optional modules the school can hide from the menu (settings
 * `module_payroll` / `module_accounting`, owned by the institution context).
 * The legacy sidebar ignored them (bug B5).
 */
export type ToggleableModule = 'payroll' | 'accounting';

export interface ModuleTogglesPort {
  /** Modules explicitly disabled by the school. */
  disabledModules(): Promise<ReadonlySet<ToggleableModule>>;
}

export const MODULE_TOGGLES = Symbol('ModuleTogglesPort');
