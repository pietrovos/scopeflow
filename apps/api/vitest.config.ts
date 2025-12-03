import { defineConfig } from 'vitest/config';
import { transform } from '@swc/core';

export default defineConfig({
  esbuild: false,
  plugins: [
    {
      name: 'nestjs-decorator-metadata',
      async transform(code, id) {
        if (!id.endsWith('.ts') || id.includes('node_modules')) return;
        return transform(code, {
          filename: id,
          sourceMaps: true,
          jsc: {
            target: 'es2022',
            parser: { syntax: 'typescript', decorators: true },
            transform: { legacyDecorator: true, decoratorMetadata: true },
          },
          module: { type: 'es6' },
        });
      },
    },
  ],
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
