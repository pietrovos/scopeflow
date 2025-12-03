import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  // No .env file: rely on the real environment (CI, containers).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations run as the schema owner, never as the RLS-restricted app role.
    url: process.env.DATABASE_OWNER_URL ?? '',
  },
});
