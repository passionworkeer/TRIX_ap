import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_OPENCLAW_PATH = 'C:/nodejs_global/node_modules/openclaw';

async function importFromOpenClawPath(relativePath: string): Promise<unknown> {
  const openclawRoot = process.env.OPENCLAW_PACKAGE_PATH ?? DEFAULT_OPENCLAW_PATH;
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
