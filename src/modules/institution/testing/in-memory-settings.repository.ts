import type { SettingsRepository } from '../domain/settings/settings.repository.js';

export class InMemorySettingsRepository implements SettingsRepository {
  readonly values = new Map<string, string | null>();

  constructor(initial: Record<string, string | null> = {}) {
    Object.entries(initial).forEach(([key, value]) => this.values.set(key, value));
  }

  async findMany(keys: readonly string[]): Promise<Map<string, string | null>> {
    return new Map(
      keys.filter((key) => this.values.has(key)).map((key) => [key, this.values.get(key) as string | null]),
    );
  }

  async saveMany(values: ReadonlyMap<string, string | null>): Promise<void> {
    values.forEach((value, key) => this.values.set(key, value));
  }
}
