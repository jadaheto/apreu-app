import type { IssuerConfig } from './issuer-config.js';

/** Output port for the issuer configuration (settings `dian_*`). */
export interface IssuerConfigRepository {
  /** Current configuration, or {@link IssuerConfig.empty} when never configured. */
  get(): Promise<IssuerConfig>;
  save(config: IssuerConfig): Promise<void>;
}

export const ISSUER_CONFIG_REPOSITORY = Symbol('IssuerConfigRepository');
