import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_DESKTOP_TARGET === 'packaged') {
    return;
  }

  if (process.env.PLAYWRIGHT_SKIP_DESKTOP_BUILD === '1') {
    return;
  }

  const repoRoot = path.dirname(fileURLToPath(import.meta.url));
  execSync('npm run build:desktop', {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}
