/** Raw key/value access to the `settings` table. */
export interface SettingsRepository {
  /** Stored values for the requested keys; missing keys are absent from the map. */
  findMany(keys: readonly string[]): Promise<Map<string, string | null>>;
  /** Upserts every entry (`null` clears the value). */
  saveMany(values: ReadonlyMap<string, string | null>): Promise<void>;
}

export const SETTINGS_REPOSITORY = Symbol('SettingsRepository');
