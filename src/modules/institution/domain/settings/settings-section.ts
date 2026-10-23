import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';
import type { SettingsSectionDefinition } from './settings-catalog.js';
import {
  SettingCodec,
  type SettingDefaultsContext,
  type SettingDefinition,
  type SettingValue,
} from './setting-definition.js';

/** What clients receive instead of a stored secret. */
export const SECRET_MASK = '••••••••';

/** Result of applying changes: rows to upsert and the canonical keys that changed. */
export interface SettingsChangeSet {
  writes: Map<string, string | null>;
  changedKeys: string[];
}

/**
 * The values of one settings tab, resolved from the raw key/value rows.
 *
 * - Reads fall back from the canonical key to its legacy aliases and then to
 *   the default (duplicated keys are unified, analysis 01 D4).
 * - Secrets are never returned: only {@link SECRET_MASK} when they hold a value.
 * - Writes are validated per key, then the section rules run on the merged
 *   values; aliases are written with the same value.
 */
export class SettingsSection {
  private constructor(
    readonly definition: SettingsSectionDefinition,
    private readonly stored: ReadonlyMap<string, string | null>,
    private readonly context: SettingDefaultsContext,
  ) {}

  /** Every key (canonical and aliases) needed to resolve the section. */
  static keysOf(definition: SettingsSectionDefinition): string[] {
    return definition.settings.flatMap((setting) => [setting.key, ...(setting.aliases ?? [])]);
  }

  static load(
    definition: SettingsSectionDefinition,
    stored: ReadonlyMap<string, string | null>,
    context: SettingDefaultsContext,
  ): SettingsSection {
    return new SettingsSection(definition, stored, context);
  }

  /** Client view of the section with secrets masked. */
  values(): Record<string, SettingValue> {
    return Object.fromEntries(
      this.definition.settings.map((setting) => {
        const raw = this.rawValue(setting);
        if (setting.secret) return [setting.key, raw ? SECRET_MASK : null];
        return [setting.key, SettingCodec.decode(setting, raw)];
      }),
    );
  }

  /** Validated rows to persist for the given client input. Unknown or read-only keys are rejected. */
  change(input: Record<string, unknown>): SettingsChangeSet {
    const next = new Map<string, string | null>();
    for (const [key, raw] of Object.entries(input)) {
      const setting = this.definition.settings.find((candidate) => candidate.key === key);
      if (!setting) {
        throw new BusinessRuleViolationError(
          `La clave "${key}" no pertenece a la sección "${this.definition.label}".`,
          'UNKNOWN_SETTING',
          {
            key,
          },
        );
      }
      if (setting.readOnly) {
        throw new BusinessRuleViolationError(`"${setting.label}" se calcula automáticamente.`, 'READ_ONLY_SETTING', {
          key,
        });
      }
      if (setting.secret && raw === SECRET_MASK) continue; // untouched secret sent back by the form
      next.set(key, SettingCodec.encode(setting, raw));
    }

    const merged = new Map(
      this.definition.settings.map((setting) => [
        setting.key,
        SettingCodec.decode(
          setting,
          next.has(setting.key) ? (next.get(setting.key) as string | null) : this.rawValue(setting),
        ),
      ]),
    );
    this.definition.rules?.forEach((rule) => rule(merged));
    Object.entries(this.definition.derive?.(merged) ?? {}).forEach(([key, value]) => next.set(key, value));

    const changedKeys = [...next.keys()].filter((key) => next.get(key) !== this.storedValue(key));
    const writes = new Map<string, string | null>();
    changedKeys.forEach((key) => {
      const setting = this.definition.settings.find((candidate) => candidate.key === key) as SettingDefinition;
      [key, ...(setting.aliases ?? [])].forEach((target) => writes.set(target, next.get(key) as string | null));
    });
    return { writes, changedKeys };
  }

  /** Canonical value, else first non-empty alias, else default. */
  private rawValue(setting: SettingDefinition): string | null {
    for (const key of [setting.key, ...(setting.aliases ?? [])]) {
      const value = this.stored.get(key);
      if (value !== null && value !== undefined && value.trim() !== '') return value;
    }
    return SettingCodec.defaultFor(setting, this.context);
  }

  /** Value currently stored under the canonical key or its aliases (no default). */
  private storedValue(key: string): string | null {
    const setting = this.definition.settings.find((candidate) => candidate.key === key) as SettingDefinition;
    const value = [key, ...(setting.aliases ?? [])]
      .map((k) => this.stored.get(k))
      .find((v) => v !== null && v !== undefined && v.trim() !== '');
    return value ?? null;
  }
}
