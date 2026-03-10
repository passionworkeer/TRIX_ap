/**
 * Crypto - Ed25519 Key Generation and Signing (Node.js)
 *
 * Handles device identity and authentication
 */

import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Load or create device identity
 */
export function loadOrCreateDeviceIdentity(identityPath?: string): {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const DEFAULT_PATH = join(process.env.HOME || process.env.USERPROFILE || '.', '.clawai', 'device-identity.json');
  const IDENTITY_PATH = identityPath || DEFAULT_PATH;

  // Ensure directory exists
  const identityDir = dirname(IDENTITY_PATH);
  if (!existsSync(identityDir)) {
    mkdirSync(identityDir, { recursive: true });
  }

  if (existsSync(IDENTITY_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(IDENTITY_PATH, 'utf8'));
      if (stored.deviceId && stored.publicKeyPem && stored.privateKeyPem) {
        return {
          deviceId: stored.deviceId,
          publicKeyPem: stored.publicKeyPem,
          privateKeyPem: stored.privateKeyPem,
        };
      }
    } catch (e) {
      // fall through
    }
  }

  // Generate new key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  // Derive deviceId from public key
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const rawKey =
    spki.length === ED25519_SPKI_PREFIX.length + 32
      ? spki.subarray(ED25519_SPKI_PREFIX.length)
      : spki;
  const deviceId = crypto.createHash('sha256').update(rawKey).digest('hex');

  const identity = { deviceId, publicKeyPem, privateKeyPem };

  writeFileSync(
    IDENTITY_PATH,
    JSON.stringify({ version: 1, ...identity, createdAtMs: Date.now() }, null, 2) + '\n',
    { mode: 0o600 }
  );

  return identity;
}

/**
 * Get raw public key bytes
 */
export function rawPublicKeyBytes(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: 'spki', format: 'der' });
  return spki.length === ED25519_SPKI_PREFIX.length + 32
    ? spki.subarray(ED25519_SPKI_PREFIX.length)
    : spki;
}

/**
 * Base64 URL encode
 */
export function base64UrlEncode(buf: Buffer | Uint8Array): string {
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

/**
 * Sign data with private key (PEM format)
 */
export function sign(data: string, privateKeyPem: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(data, 'utf8'), key);
  return base64UrlEncode(signature);
}

/**
 * Build signed device payload (matching ClawPilot protocol)
 */
export function buildSignedDevice(identity: {
  deviceId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}, opts: {
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string;
  nonce?: string;
}) {
  const version = opts.nonce ? 'v2' : 'v1';
  const payload = [
    version,
    identity.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    opts.scopes.join(','),
    String(opts.signedAtMs),
    opts.token ?? '',
    ...(version === 'v2' ? [opts.nonce ?? ''] : []),
  ].join('|');

  const signature = sign(payload, identity.privateKeyPem);

  return {
    id: identity.deviceId,
    publicKey: base64UrlEncode(rawPublicKeyBytes(identity.publicKeyPem)),
    signature,
    signedAt: opts.signedAtMs,
    nonce: opts.nonce,
  };
}

/**
 * Generate a random ID
 */
export function generateRandomId(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}
