#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { TrixNativeServer } from './server/TrixNativeServer.js';
import { JsonStateStore } from './storage/JsonStateStore.js';
import { randomToken } from './utils/ids.js';

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const result = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (typeof value !== 'string' || !value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result.set(key, true);
      continue;
    }
    result.set(key, next);
    index += 1;
  }
  return result;
}

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadDotEnvFiles(cwd: string): void {
  const preservedKeys = new Set(Object.keys(process.env));
  const envFiles = ['.env', '.env.local'];

  for (const fileName of envFiles) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const matched = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!matched) {
        continue;
      }

      const key = matched[1];
      const rawValue = matched[2];
      if (key === undefined || rawValue === undefined) {
        continue;
      }
      if (preservedKeys.has(key) && process.env[key] != null) {
        continue;
      }

      process.env[key] = parseEnvValue(rawValue);
    }
  }
}

async function main(): Promise<void> {
  loadDotEnvFiles(process.cwd());

  const [command, subcommand, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  const storageDir = typeof flags.get('storage-dir') === 'string'
    ? String(flags.get('storage-dir'))
    : process.env.TRIX_NATIVE_STORAGE_DIR;
  const resolvedStorageDir = path.resolve(storageDir ?? path.join(process.cwd(), '.trix-native-channel'));

  if (command === 'server' && subcommand === 'start') {
    const server = new TrixNativeServer({
      host: String(flags.get('host') ?? '0.0.0.0'),
      port: Number(flags.get('port') ?? 8788),
      storageDir: resolvedStorageDir,
      publicBaseUrl: typeof flags.get('public-base-url') === 'string' ? String(flags.get('public-base-url')) : process.env.TRIX_NATIVE_PUBLIC_BASE_URL,
      adminToken: typeof flags.get('admin-token') === 'string' ? String(flags.get('admin-token')) : process.env.TRIX_NATIVE_ADMIN_TOKEN,
      serviceToken: typeof flags.get('service-token') === 'string' ? String(flags.get('service-token')) : process.env.TRIX_NATIVE_SERVICE_TOKEN,
      attachmentSigningSecret: typeof flags.get('attachment-signing-secret') === 'string'
        ? String(flags.get('attachment-signing-secret'))
        : process.env.TRIX_NATIVE_ATTACHMENT_SIGNING_SECRET,
      supabaseUrl: typeof flags.get('supabase-url') === 'string'
        ? String(flags.get('supabase-url'))
        : process.env.TRIX_NATIVE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: typeof flags.get('supabase-anon-key') === 'string'
        ? String(flags.get('supabase-anon-key'))
        : process.env.TRIX_NATIVE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
      serviceAllowlist: typeof flags.get('service-allowlist') === 'string'
        ? String(flags.get('service-allowlist')).split(',').map((entry) => entry.trim()).filter(Boolean)
        : undefined,
      trustedProxyAllowlist: typeof flags.get('trusted-proxy-allowlist') === 'string'
        ? String(flags.get('trusted-proxy-allowlist')).split(',').map((entry) => entry.trim()).filter(Boolean)
        : undefined,
      enableLegacyAgentWs: flags.get('enable-legacy-agent-ws') === true,
    });
    await server.start();
    process.stdout.write(`TRIX Native server listening at ${server.getBaseUrl()}\n`);
    return;
  }

  if (command === 'server' && subcommand === 'rotate-service-token') {
    const accountId = typeof flags.get('account-id') === 'string' ? String(flags.get('account-id')) : 'default';
    const length = Number(flags.get('length') ?? 32);
    const store = new JsonStateStore(resolvedStorageDir);
    await store.ensure();
    const token = randomToken(Number.isFinite(length) && length > 0 ? length : 32);
    await store.update((state) => ({
      ...state,
      serviceTokens: {
        ...state.serviceTokens,
        [accountId]: token,
      },
    }));
    process.stdout.write(`${JSON.stringify({
      accountId,
      serviceToken: token,
      storageDir: resolvedStorageDir,
    }, null, 2)}\n`);
    return;
  }

  if (command === 'pairing' && subcommand === 'create') {
    const serverUrl = String(flags.get('server') ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
    const response = await fetch(`${serverUrl}/api/pairings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${String(flags.get('service-token') ?? process.env.TRIX_NATIVE_SERVICE_TOKEN ?? '')}`,
      },
      body: JSON.stringify({
        accountId: typeof flags.get('account-id') === 'string' ? String(flags.get('account-id')) : 'default',
        label: typeof flags.get('label') === 'string' ? String(flags.get('label')) : undefined,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create pairing: ${response.status} ${response.statusText}`);
    }
    const pairing = await response.json() as { code: string; claimUrl: string };
    process.stdout.write(`Pairing code: ${pairing.code}\nJoin URL: ${pairing.claimUrl}\n`);
    return;
  }

  process.stdout.write([
    'Usage:',
    '  trix-openclaw-native server start --host 0.0.0.0 --port 8788',
    '    [--service-allowlist 203.0.113.10,10.0.0.0/24] [--trusted-proxy-allowlist 127.0.0.1,10.0.0.0/24]',
    '  trix-openclaw-native server rotate-service-token --storage-dir ./.trix-native-channel --account-id default',
    '  trix-openclaw-native pairing create --server http://127.0.0.1:8788 --service-token <token>',
  ].join('\n'));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
