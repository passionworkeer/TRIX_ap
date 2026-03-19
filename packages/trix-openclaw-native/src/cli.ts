#!/usr/bin/env node
import { TrixNativeServer } from './server/TrixNativeServer.js';

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const result = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value?.startsWith('--')) {
      continue;
    }
    const key = (value ?? '').slice(2);
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

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);

  if (command === 'server' && subcommand === 'start') {
    const server = new TrixNativeServer({
      host: String(flags.get('host') ?? '0.0.0.0'),
      port: Number(flags.get('port') ?? 8788),
      storageDir: typeof flags.get('storage-dir') === 'string' ? String(flags.get('storage-dir')) : process.env.TRIX_NATIVE_STORAGE_DIR,
      publicBaseUrl: typeof flags.get('public-base-url') === 'string' ? String(flags.get('public-base-url')) : process.env.TRIX_NATIVE_PUBLIC_BASE_URL,
      adminToken: typeof flags.get('admin-token') === 'string' ? String(flags.get('admin-token')) : process.env.TRIX_NATIVE_ADMIN_TOKEN,
    });
    await server.start();
    process.stdout.write(`TRIX Native server listening at ${server.getBaseUrl()}\n`);
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
    '  trix-openclaw-native pairing create --server http://127.0.0.1:8788 --service-token <token>',
  ].join('\n'));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
