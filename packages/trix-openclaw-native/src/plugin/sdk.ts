import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FALLBACK_OPENCLAW_ROOTS = [
  process.env.OPENCLAW_PACKAGE_PATH,
  path.join(process.cwd(), 'node_modules', 'openclaw'),
  path.join(os.homedir(), 'npm-global', 'node_modules', 'openclaw'),
  path.join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'openclaw'),
  'C:/nodejs_global/node_modules/openclaw',
].filter((value): value is string => Boolean(value));

function resolveOpenClawRoot(relativePath: string): string {
  for (const root of FALLBACK_OPENCLAW_ROOTS) {
    if (fs.existsSync(path.join(root, relativePath))) {
      return root;
    }
  }

  return FALLBACK_OPENCLAW_ROOTS[0] ?? 'C:/nodejs_global/node_modules/openclaw';
}

async function importFromOpenClawPath(relativePath: string): Promise<unknown> {
  const openclawRoot = resolveOpenClawRoot(relativePath);
  const absolute = path.join(openclawRoot, relativePath);
  return import(pathToFileURL(absolute).href);
}

export async function resolveOpenClawCompat(): Promise<Record<string, unknown>> {
  try {
    return (await import('openclaw/plugin-sdk/compat')) as Record<string, unknown>;
  } catch {
    return (await importFromOpenClawPath('dist/plugin-sdk/compat.js')) as Record<string, unknown>;
  }
}

export async function resolveOpenClawCoreSdk(): Promise<Record<string, unknown>> {
  try {
    return (await import('openclaw/plugin-sdk')) as Record<string, unknown>;
  } catch {
    return (await importFromOpenClawPath('dist/plugin-sdk/index.js')) as Record<string, unknown>;
  }
}
