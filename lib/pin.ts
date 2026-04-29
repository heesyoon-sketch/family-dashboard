const LEGACY_SALT = 'familydashboard-salt';

async function deriveHash(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('v1:');
}

export async function hashPin(pin: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await deriveHash(pin, saltHex);
  return `v1:${saltHex}:${hash}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (isLegacyHash(stored)) {
    return (await deriveHash(pin, LEGACY_SALT)) === stored;
  }
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [, saltHex, expectedHash] = parts;
  return (await deriveHash(pin, saltHex)) === expectedHash;
}
