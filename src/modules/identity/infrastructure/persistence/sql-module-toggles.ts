import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { ModuleTogglesPort, ToggleableModule } from '../../domain/module-toggles.port.js';

const SETTING_BY_MODULE: Record<ToggleableModule, string> = {
  payroll: 'module_payroll',
  accounting: 'module_accounting',
};

/**
 * Reads the menu switches from `settings` (written by the institution
 * context). Missing keys mean "enabled", as in the legacy seed.
 */
@Injectable()
export class SqlModuleToggles implements ModuleTogglesPort {
  constructor(private readonly db: TenantDataSource) {}

  async disabledModules(): Promise<ReadonlySet<ToggleableModule>> {
    const rows: { key: string; value: string | null }[] = await (
      await this.db.manager()
    ).query('SELECT key, value FROM settings WHERE key = ANY($1)', [Object.values(SETTING_BY_MODULE)]);
    const disabledKeys = new Set(rows.filter((row) => row.value?.trim() === '0').map((row) => row.key));
    return new Set(
      (Object.entries(SETTING_BY_MODULE) as [ToggleableModule, string][])
        .filter(([, key]) => disabledKeys.has(key))
        .map(([module]) => module),
    );
  }
}
