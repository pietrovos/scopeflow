import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Every run starts from the same demo data. */
export default function globalSetup() {
  execFileSync('pnpm', ['--filter', '@scopeflow/api', 'db:seed'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
  });
}
