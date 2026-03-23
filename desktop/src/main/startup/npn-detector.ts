import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PackageInfo {
  name: string;
  command: string;
  arg: string;
  installed: boolean;
  version?: string;
  error?: string;
}

const PACKAGES: Omit<PackageInfo, 'installed' | 'version' | 'error'>[] = [
  { name: 'Node.js',  command: 'node',     arg: '--version' },
  { name: 'npm',      command: 'npm',      arg: '--version' },
  { name: 'pnpm',     command: 'pnpm',     arg: '--version' },
  { name: 'openclaw', command: 'openclaw', arg: '--version' },
];

export async function detectPackages(): Promise<PackageInfo[]> {
  const results = await Promise.allSettled(
    PACKAGES.map(async (pkg): Promise<PackageInfo> => {
      try {
        const { stdout } = await execAsync(`"${pkg.command}" ${pkg.arg}`, { timeout: 8000 });
        const version = stdout.trim().replace(/^v/, '');
        return { ...pkg, installed: true, version };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ...pkg, installed: false, error: msg.includes('ENOENT') ? '未找到' : msg };
      }
    })
  );

  return results.map((r, i): PackageInfo => {
    if (r.status === 'fulfilled') return r.value;
    const pkg = PACKAGES[i]!;
    return { name: pkg.name, command: pkg.command, arg: pkg.arg, installed: false, error: '检测失败' };
  });
}
