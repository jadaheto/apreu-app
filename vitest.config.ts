import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Unit-test configuration.
 * SWC is required so decorators emit `design:paramtypes` metadata, which the
 * NestJS DI container relies on when building testing modules.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.orm-entity.ts',
        'src/**/*.dto.ts',
        'src/**/index.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
