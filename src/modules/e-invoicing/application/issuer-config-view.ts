import type { IssuerConfig, IssuerConfigProps } from '../domain/issuer-config.js';

/** Issuer configuration as returned by the API: secrets are never exposed. */
export type IssuerConfigView = Omit<IssuerConfigProps, 'softwarePin'> & {
  dv: string;
  softwarePinConfigured: boolean;
};

export const toIssuerConfigView = (config: IssuerConfig): IssuerConfigView => {
  const { softwarePin, ...props } = config.toProps();
  return { ...props, dv: config.dv, softwarePinConfigured: Boolean(softwarePin) };
};
