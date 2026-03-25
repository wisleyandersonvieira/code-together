import { corsHeaders } from './cors.ts';

const encoder = new TextEncoder();

const HASH_VERSION = 'v1';
const ITERATIONS = 100_000;
const HASH_BYTES = 32;

let postgres: unknown = null;

type PostgresFactory = (url: string, options: Record<string, unknown>) => SqlClient;

type SqlQueryResult = Array<Record<string, unknown>>;

type SqlClient = {
  <T extends SqlQueryResult = SqlQueryResult>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  end: (options?: { timeout?: number }) => Promise<void>;
};

export interface AppUserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function sanitiseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSqlClient(): Promise<SqlClient> {
  if (!postgres) {
    const mod = await import('https://deno.land/x/postgresjs@v3.4.5/mod.js');
    postgres = mod.default;
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL not configured');
  }

  const factory = postgres as PostgresFactory;
  return factory(dbUrl, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
    prepare: true,
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveHash(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BYTES * 8,
  );

  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  return `${HASH_VERSION}:${bytesToBase64(salt)}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;

  if (!storedHash.startsWith(`${HASH_VERSION}:`)) {
    return constantTimeEquals(btoa(password), storedHash);
  }

  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;

  try {
    const salt = base64ToBytes(parts[1]);
    const actualHash = await deriveHash(password, salt);
    return constantTimeEquals(actualHash, parts[2]);
  } catch {
    return false;
  }
}

export function toPublicUser(user: AppUserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function createResetToken(): string {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(tokenBytes).replace(/[+/=]/g, (char) => {
    if (char === '+') return '-';
    if (char === '/') return '_';
    return '';
  });
}
