import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(prefix: string, size = 16): string {
  return `${prefix}_${crypto.randomBytes(size).toString('hex')}`;
}

export function randomToken(size = 24): string {
  return crypto.randomBytes(size).toString('base64url');
}

export function randomPairingCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length] ?? CODE_ALPHABET[0];
  }
  return code;
}

export function normalizePairingCode(code: string): string {
  return code.trim().replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
