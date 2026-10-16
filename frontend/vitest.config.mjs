import { defineConfig } from 'vitest/config';

/**
 * Frontend tests.
 *
 * Unit and component-level only — there is no browser in this suite, so
 * anything that needs a DOM is tested against pure functions instead. The
 * dictionary completeness check is the most important test here: it is what
 * keeps a missing Tigrinya or Amharic string from reaching a resident.
 *
 * The `src/**` directory aliases match `jsconfig.json`, so a test can import
 * `@/lib/...` exactly as an application file does.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.js', 'src/**/*.spec.jsx'],
  },
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
});