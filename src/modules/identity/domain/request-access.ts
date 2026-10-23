/** An HTTP request already answered, as seen by the access audit. */
export interface AnsweredRequest {
  method: string;
  /** Original URL, including the `/api` prefix and the query string. */
  url: string;
  statusCode: number;
}

/** What gets stored in `access_log` for an API request. */
export interface RequestAccess {
  /** `METHOD /api/path` without the query string (it may carry personal data). */
  path: string;
  /** First path segment after `/api`, e.g. `students` (legacy `enforcePageAccess($module)`). */
  module: string;
  /** `false` when the API denied the request for lack of permissions (403). */
  allowed: boolean;
}

const API_PREFIX = '/api/';
const IGNORED_METHODS = new Set(['OPTIONS', 'HEAD']);
/**
 * Paths not audited per request: health checks, documentation, static
 * assets, service-to-service calls, and the authentication endpoints that
 * already write their own, more precise, entry (`LoginUseCase`,
 * `LogoutUseCase`).
 */
const IGNORED_PATHS = [
  /^\/api\/health(?:\/|$)/,
  /^\/api\/docs(?:\/|$)/,
  /^\/api\/internal(?:\/|$)/,
  /^\/api\/auth\/(?:login|logout)$/,
  /\.(?:css|js|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf)$/i,
];

/**
 * `GET` reads polled automatically by the web client that would flood
 * `access_log` without telling anything about the user's activity: the
 * notification bell (every 60 s) and the school branding loaded on each page.
 * Other methods on the same paths (e.g. `POST /api/notifications`) are audited.
 */
const IGNORED_READS = [/^\/api\/notifications\/?$/, /^\/api\/institution\/branding\/?$/];

/**
 * Access audit policy (legacy `config/middleware.php::logAccess`, which
 * recorded every page view). Returns `null` for requests that must not be
 * audited.
 */
export const describeRequestAccess = ({ method, url, statusCode }: AnsweredRequest): RequestAccess | null => {
  const verb = method.toUpperCase();
  const pathname = url.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/');
  if (IGNORED_METHODS.has(verb) || !pathname.startsWith(API_PREFIX)) return null;
  if (IGNORED_PATHS.some((pattern) => pattern.test(pathname))) return null;
  if (verb === 'GET' && IGNORED_READS.some((pattern) => pattern.test(pathname))) return null;
  const module = pathname.slice(API_PREFIX.length).split('/', 1)[0];
  if (!module) return null;
  return { path: `${verb} ${pathname}`, module, allowed: statusCode !== 403 };
};
