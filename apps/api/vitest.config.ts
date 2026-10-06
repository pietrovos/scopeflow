import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['test/support/global-setup.ts'],
          setupFiles: ['test/support/env.ts'],
          // One database, so integration files run one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
