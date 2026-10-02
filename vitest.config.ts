import { defineConfig } from 'vitest/config';

/**
 * Tests live under `test/` (outside `src/`) so they are never emitted into
 * `dist/` by `tsc`. They import the TypeScript sources directly; vitest
 * compiles on the fly, so no build step is needed to run the suite.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
