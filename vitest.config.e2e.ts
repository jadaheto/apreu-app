import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * End-to-end configuration: boots the real `AppModule` against PostgreSQL
 * (cloned databases, see `test/support/global-setup.ts`). Only the external
 * gateways (DIAN, SMTP, WhatsApp, AI) are replaced by test doubles.
 * Defaults target a PostgreSQL reachable at 127.0.0.1:5432 (the API container
 * shares the network namespace of `apreu-dev-pg`); override with the env vars.
 */
const env = (key: string, fallback: string): string => process.env[key] ?? fallback;

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'e2e-jwt-secret-with-at-least-32-characters!!',
      TENANT_DB_HOST: env('TENANT_DB_HOST', '127.0.0.1'),
      TENANT_DB_PORT: env('TENANT_DB_PORT', '5432'),
      TENANT_DB_USER: env('TENANT_DB_USER', 'postgres'),
      TENANT_DB_PASSWORD: env('TENANT_DB_PASSWORD', 'postgres'),
      MASTER_DB_NAME: 'apreu_e2e_master',
      DEFAULT_TENANT: '',
      TENANT_CACHE_TTL_SECONDS: '60',
      TENANT_STATUS_TTL_SECONDS: '60',
      INTERNAL_API_TOKEN: 'e2e-internal-token-0123456789abcdef',
      UPLOADS_DIR: env('E2E_UPLOADS_DIR', '/tmp/apreu-e2e-uploads'),
      DOCUMENT_VERIFY_URL_TEMPLATE: 'https://{tenant}.apreu.co/verificar/{code}?tipo={kind}',
      E_INVOICING_SECRET_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  },
});
