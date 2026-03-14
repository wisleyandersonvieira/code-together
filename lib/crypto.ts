/**
 * Secure password hashing using Web Crypto API (PBKDF2 + SHA-256).
 * Stored format: "v1:<base64salt>:<base64hash>"
 *
 * Backwards-compatible: verifies legacy btoa() hashes so existing
 * passwords keep working until the user changes them.
 */

const ITERATIONS = 100_000;
const HASH_BYTES = 32;

async function deriveKey(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  const saltB64 = btoa(String.fromCharCode(...salt));
  return `v1:${saltB64}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  // Legacy: plain base64 (btoa). Kept for migration — no timing-safe compare needed
  // because we upgrade on next login anyway.
  if (!stored.startsWith('v1:')) {
    return btoa(password) === stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;

  const salt = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const actual = await deriveKey(password, salt);

  // Constant-time comparison to avoid timing attacks
  const expected = parts[2];
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
