import { resolve } from 'node:path';

/**
 * Typed application configuration read from environment variables.
 *
 * Validation happens once at startup (`validateEnvironment`) so the rest of
 * the code can rely on well-formed values. Secrets never have defaults.
 */
export interface Environment {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  /** Express `trust proxy` (`TRUST_PROXY`); `false` when the API is not behind a reverse proxy. */
  trustProxy: number | string | false;
  jwt: { secret: string; expiresIn: string };
  /** Master database: holds the `tenants` registry. */
  masterDb: DatabaseConnection & { database: string };
  /** Server hosting one database per school. */
  tenantDb: DatabaseConnection & { databasePrefix: string };
  /** Tenant used when a request has no `X-Tenant` header (local development). */
  defaultTenant: string | null;
  /** Seconds a resolved tenant stays cached. */
  tenantCacheTtlSeconds: number;
  /**
   * Seconds a cached tenant's `status` is trusted before it is re-read from the
   * master DB (cheap query), so a suspension takes effect quickly even on
   * instances that did not receive the invalidation call. `0` checks it on
   * every request.
   */
  tenantStatusTtlSeconds: number;
  /**
   * Minutes a school's connection pool may stay unused before it is closed
   * (one PostgreSQL pool per school database). `0` keeps pools open forever.
   */
  tenantPoolIdleMinutes: number;
  /**
   * Shared secret for the internal endpoints called by `superadmin-api`
   * (`/api/internal/**`). `null` disables them.
   */
  internalApiToken: string | null;
  /** Root folder for uploaded files; each school gets its own sub-folder. Never web-served. */
  storage: { uploadsDir: string };
  /** Secret signing the student ID-card QR; `null` derives it from the JWT secret. */
  studentQrSecret: string | null;
  /**
   * URL encoded in the QR of verifiable documents (certificates). Placeholders:
   * `{tenant}`, `{kind}` (`estudiantil` | `laboral`) and `{code}`. `null`
   * encodes the verification code only.
   */
  documentVerifyUrlTemplate: string | null;
  eInvoicing: {
    /** Absolute folder with `<tenant>.pem` certificates (outside the app directory). */
    certsDir: string | null;
    /** Base64 32-byte key encrypting DIAN secrets at rest. */
    secretKey: string | null;
  };
}

export interface DatabaseConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

export const ENVIRONMENT = Symbol('Environment');

const required = (env: NodeJS.ProcessEnv, key: string): string => {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Variable de entorno obligatoria no definida: ${key}`);
  }
  return value;
};

const optional = (env: NodeJS.ProcessEnv, key: string): string | null => env[key]?.trim() || null;

const integer = (env: NodeJS.ProcessEnv, key: string, fallback: number): number => {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`La variable ${key} debe ser un número entero.`);
  return parsed;
};

/**
 * `TRUST_PROXY`: Express `trust proxy` (number of proxies or their IPs/subnets) so `req.ip`,
 * which keys the throttler, is the client and not the reverse proxy. Empty = off: with the API
 * exposed directly, trusting `X-Forwarded-For` would let clients spoof their IP.
 */
const trustProxy = (env: NodeJS.ProcessEnv): number | string | false => {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw || raw === 'false' || raw === '0') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === 'true') {
    throw new Error(
      'TRUST_PROXY=true confía en cualquier X-Forwarded-For; indique el número de proxies (p. ej. 1) o sus IP.',
    );
  }
  return raw;
};

/** `INTERNAL_API_TOKEN`: optional, but at least 32 characters in production when set. */
const internalToken = (env: NodeJS.ProcessEnv, nodeEnv: Environment['nodeEnv']): string | null => {
  const token = optional(env, 'INTERNAL_API_TOKEN');
  if (token && nodeEnv === 'production' && token.length < 32) {
    throw new Error('INTERNAL_API_TOKEN debe tener al menos 32 caracteres en producción.');
  }
  return token;
};

/** Builds and validates the {@link Environment}; throws on the first invalid value. */
export const loadEnvironment = (env: NodeJS.ProcessEnv = process.env): Environment => {
  const nodeEnv = (env.NODE_ENV ?? 'development') as Environment['nodeEnv'];
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV inválido: ${nodeEnv}`);
  }
  const jwtSecret = required(env, 'JWT_SECRET');
  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  }

  const tenantHost = required(env, 'TENANT_DB_HOST');
  return {
    nodeEnv,
    port: integer(env, 'PORT', 3000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: trustProxy(env),
    jwt: { secret: jwtSecret, expiresIn: env.JWT_EXPIRES_IN ?? '8h' },
    masterDb: {
      host: env.MASTER_DB_HOST ?? tenantHost,
      port: integer(env, 'MASTER_DB_PORT', integer(env, 'TENANT_DB_PORT', 5432)),
      username: env.MASTER_DB_USER ?? required(env, 'TENANT_DB_USER'),
      password: env.MASTER_DB_PASSWORD ?? env.TENANT_DB_PASSWORD ?? '',
      database: required(env, 'MASTER_DB_NAME'),
    },
    tenantDb: {
      host: tenantHost,
      port: integer(env, 'TENANT_DB_PORT', 5432),
      username: required(env, 'TENANT_DB_USER'),
      password: env.TENANT_DB_PASSWORD ?? '',
      databasePrefix: env.TENANT_DB_PREFIX ?? 'apreu_',
    },
    defaultTenant: env.DEFAULT_TENANT?.trim() || null,
    tenantCacheTtlSeconds: integer(env, 'TENANT_CACHE_TTL_SECONDS', 60),
    tenantStatusTtlSeconds: Math.max(0, integer(env, 'TENANT_STATUS_TTL_SECONDS', 5)),
    tenantPoolIdleMinutes: Math.max(0, integer(env, 'TENANT_POOL_IDLE_MINUTES', 30)),
    internalApiToken: internalToken(env, nodeEnv),
    storage: { uploadsDir: resolve(optional(env, 'UPLOADS_DIR') ?? 'uploads') },
    studentQrSecret: optional(env, 'STUDENT_QR_SECRET'),
    documentVerifyUrlTemplate: optional(env, 'DOCUMENT_VERIFY_URL_TEMPLATE'),
    eInvoicing: {
      certsDir: optional(env, 'E_INVOICING_CERTS_DIR'),
      secretKey: optional(env, 'E_INVOICING_SECRET_KEY'),
    },
  };
};
