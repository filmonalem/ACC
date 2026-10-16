import { defineConfig } from 'vitest/config';
import { swcTransform } from './vitest.transform';

/**
 * Integration tests: real PostgreSQL, real HTTP stack, real auth cookies.
 *
 * These prove the things a unit test cannot — that the guards are actually
 * registered in the right order, that a transaction rolls back, that a
 * permission refusal really produces 403 rather than a service-layer no-op.
 *
 * `DATABASE_URL` must point at a disposable database. The suite truncates the
 * tables it touches; never point it at a database holding real submissions.
 *
 *   DATABASE_URL=postgresql:///acc_test?host=/var/run/postgresql npm run test:integration
 */
export default defineConfig({
  // SWC rather than esbuild: see vitest.transform.ts for why decorator metadata
  // is mandatory for Nest's dependency injection.
  plugins: [swcTransform()],
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.integration-spec.ts'],
    // Tests share one database, so they must not interleave their writes.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});