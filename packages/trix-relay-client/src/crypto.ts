/**
 * Crypto - Ed25519 Key Generation and Signing
 *
 * Handles device identity and authentication
 */

/**
 * Generate an Ed25519 key pair in the browser
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );

  const publicKeyRaw = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyRaw = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: base64UrlEncode(new Uint8Array(publicKeyRaw)),
    privateKey: base64UrlEncode(new Uint8Array(privateKeyRaw)),
  };
}

/**
 * Sign data with private key
 */
export async function sign(data: string, privateKeyBase64: string): Promise<string> {
  // Decode base64 URL to binary
  const binary = atob(privateKeyBase64.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'Ed25519' },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(data)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Build signed device payload (matching ClawPilot protocol)
 */
export async function buildSignedDevice(opts: {
  deviceId: string;
  privateKey: string;
  publicKey: string;
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
    opts.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    opts.scopes.join(','),
    String(opts.signedAtMs),
    opts.token ?? '',
    ...(version === 'v2' ? [opts.nonce ?? ''] : []),
  ].join('|');

  const signature = await sign(payload, opts.privateKey);

  return {
    id: opts.deviceId,
    publicKey: opts.publicKey,
    signature,
    signedAt: opts.signedAtMs,
    nonce: opts.nonce,
  };
}

/**
 * Generate a random ID
 */
export function generateRandomId(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Base64 URL encode
 */
export function base64UrlEncode(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    const char = buf[i];
    if (char !== undefined) {
      binary += String.fromCharCode(char);
    }
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

/**
 * Base64 URL decode
 */
export function base64UrlDecode(str: string): Uint8Array {
  const binary = atob(str.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
