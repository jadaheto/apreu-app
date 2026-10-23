/**
 * Routes that do not belong to a school (no `X-Tenant` needed): health
 * checks, Swagger and the service-to-service endpoints of `superadmin-api`.
 * Expressed relative to the global `/api` prefix, as Nest middleware expects.
 */
export const TENANTLESS_ROUTES = ['health', 'docs', 'docs/{*path}', 'internal/{*path}'];
