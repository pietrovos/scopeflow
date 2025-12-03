import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace dependencies from the monorepo root so the standalone build includes
  // workspace packages.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  transpilePackages: ['@scopeflow/shared'],
  poweredByHeader: false,
};

export default nextConfig;
