/** Lifecycle status of a school in the master registry (`tenants.status`). */
export type TenantStatus = 'active' | 'suspended' | 'trial';

/** A school served by the platform, as registered in the master database. */
export interface Tenant {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  /** Physical database holding the school's data. */
  databaseName: string;
}

const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;

export const isValidTenantSlug = (slug: string): boolean => SLUG_PATTERN.test(slug);

/** Legacy naming rule: `apreu_` + slug with dashes replaced by underscores. */
export const defaultDatabaseName = (prefix: string, slug: string): string => `${prefix}${slug.replace(/-/g, '_')}`;
