import { defineConfig } from 'vitest/config';
import { swcTransform } from './vitest.transform';

/**
 * End-to-end tests: the full resident → staff journey over HTTP.
 *
 * Separate from the integration suite because these run the whole lifecycle in
 * one scenario — submit, look up, triage, assign, escalate, resolve — and are
 * the tests that would catch a wiring regression between modules.
 *
 * `DATABASE_URL` must point at a disposable database.
 */
export default defineConfig({
  // SWC rather than esbuild: see vitest.transform.ts for why decorator metadata
  // is mandatory for Nest's dependency injection.
  plugins: [swcTransform()],
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});