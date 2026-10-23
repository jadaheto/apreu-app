/**
 * Key/value access to the tenant `settings` table (owned by the identity
 * context). Missing keys are simply absent from the result.
 */
export interface SettingsStorePort {
  read(keys: readonly string[]): Promise<Record<string, string>>;
  write(key: string, value: string): Promise<void>;
}

export const SETTINGS_STORE = Symbol('SettingsStorePort');
