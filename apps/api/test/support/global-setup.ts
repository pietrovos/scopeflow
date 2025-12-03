import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Brings the test database up to the latest migration once per run. */
export default function setup() {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '../../../../.env'));
  } catch {
    // CI provides the variables directly.
  }
  const url = process.env.TEST_DATABASE_OWNER_URL;
  if (!url) throw new Error('TEST_DATABASE_OWNER_URL is not set');
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_OWNER_URL: url },
    stdio: 'pipe',
  });
}
