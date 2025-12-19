import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Local development shares the monorepo's root .env. Containers get real env vars.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // No .env file.
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace dependencies from the monorepo root so the standalone build includes
  // workspace packages.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@scopeflow/shared'],
  poweredByHeader: false,
  experimental: { authInterrupts: true },
};

export default nextConfig;
