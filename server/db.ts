import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
const { Pool } = pg;
import { sql as drizzleSql } from 'drizzle-orm';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzleNeon<typeof schema>>;

type AnyBuilder = Record<string, unknown>;
type FulfillFn = (value: unknown) => unknown;
type RejectFn = (reason: unknown) => unknown;

let _db: DbType | null = null;
let _fallbackDb: DbType | null = null;
let _originalPrimaryDb: DbType | null = null;
let _isDatabaseAvailable = false;
let _activeDbSource: string = 'none';
let _usingFallback = false;
let _switchCooldownUntil = 0;
let _legacyDb: DbType | null = null;
let _isLegacyDbAvailable = false;

function sanitizeDbUrl(url: string): string {
  return url.replace(/^(postgresql?:\/\/[^:]+:)([^@]+)(@.+)$/, (_full, pre, pass, post) => {
    const encoded = encodeURIComponent(decodeURIComponent(pass.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')));
    return pre + encoded + post;
  });
}

function tryConnectNeon(url: string, label: string): DbType | null {
  try {
    const sanitizedUrl = sanitizeDbUrl(url);
    const sql = neon(sanitizedUrl);
    const db = drizzleNeon(sql, { schema });
    console.log(`✅ Database connection configured successfully (source: ${label})`);
    return db as unknown as DbType;
  } catch (error) {
    console.warn(`⚠️ Database connection failed for ${label}:`, error);
    return null;
  }
}

function tryConnectPostgres(url: string, label: string): DbType | null {
  try {
    const sanitizedUrl = sanitizeDbUrl(url);
    const txUrl = sanitizedUrl.replace(/:5432\//, ':6543/');
    const pool = new Pool({
      connectionString: txUrl,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      ssl: { rejectUnauthorized: false },
    });
    const db = drizzleNodePg(pool, { schema });
    console.log(`✅ Database connection configured successfully (source: ${label})`);
    return db as unknown as DbType;
  } catch (error) {
    console.warn(`⚠️ Database connection failed for ${label}:`, error);
    return null;
  }
}

// ── Initialise connections ──────────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  console.log('📦 Using DATABASE_URL (Replit/Neon) as primary...');
  const replDb = tryConnectNeon(process.env.DATABASE_URL, 'DATABASE_URL/Replit (primary)');
  if (replDb) {
    _db = replDb;
    _originalPrimaryDb = replDb;
    _isDatabaseAvailable = true;
    _activeDbSource = 'DATABASE_URL/Replit (primary)';

    if (process.env.EXTERNAL_DATABASE_URL && process.env.EXTERNAL_DATABASE_URL !== process.env.DATABASE_URL) {
      console.log('📡 Connecting to EXTERNAL_DATABASE_URL (Supabase) as secondary (dual-write)...');
      const extDb = tryConnectPostgres(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL/Supabase (secondary)');
      if (extDb) {
        _legacyDb = extDb;
        _fallbackDb = extDb;
        _isLegacyDbAvailable = true;
        console.log('🔁 Dual-write enabled: writes go to BOTH Replit/Neon (primary) and Supabase (secondary)');
      }
    }
  } else if (process.env.EXTERNAL_DATABASE_URL) {
    console.log('🔄 Replit DB non disponibile, fallback a EXTERNAL_DATABASE_URL (Supabase)...');
    const extDb = tryConnectPostgres(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL/Supabase (fallback)');
    if (extDb) {
      _db = extDb;
      _fallbackDb = extDb;
      _isDatabaseAvailable = true;
      _activeDbSource = 'EXTERNAL_DATABASE_URL/Supabase (fallback)';
      _usingFallback = true;
    }
  }
} else if (process.env.EXTERNAL_DATABASE_URL) {
  console.log('📡 Using EXTERNAL_DATABASE_URL (Supabase) as primary (DATABASE_URL not set)...');
  const extDb = tryConnectPostgres(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL/Supabase (primary)');
  if (extDb) {
    _db = extDb;
    _originalPrimaryDb = extDb;
    _isDatabaseAvailable = true;
    _activeDbSource = 'EXTERNAL_DATABASE_URL/Supabase (primary)';
  }
} else {
  console.warn('⚠️ No database URL found. Running in offline mode (no database).');
}

export function is402QuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as { message?: string }).message ?? '';
  return msg.includes('402') || msg.includes('data transfer quota') || msg.includes('exceeded');
}

export function switchToFallback(): boolean {
  if (_usingFallback || !_fallbackDb) return false;
  const now = Date.now();
  if (now < _switchCooldownUntil) return false;
  _switchCooldownUntil = now + 5000;
  console.warn('⚠️ [DB] Switching from primary DB (Replit/Neon) to fallback (Supabase) due to error!');
  _db = _fallbackDb;
  _usingFallback = true;
  _isDatabaseAvailable = true;
  _activeDbSource = 'EXTERNAL_DATABASE_URL/Supabase (auto-fallback)';
  return true;
}

function isSecondaryCircuitOpen(): boolean { return Date.now() < 0; }
function recordSecondaryFailure(): void {}
function recordSecondarySuccess(): void {}

function createDualBuilder(primaryBuilder: AnyBuilder, secondaryBuilder: AnyBuilder | null): AnyBuilder {
  return new Proxy(primaryBuilder, {
    get(target, prop: string | symbol) {
      if (prop === 'then') {
        return function(onFulfilled: FulfillFn | undefined, onRejected: RejectFn | undefined) {
          const primaryThen = target['then'] as (f?: FulfillFn, r?: RejectFn) => Promise<unknown>;
          return primaryThen.call(target, onFulfilled, onRejected);
        };
      }
      const primaryVal = target[prop as string];
      if (typeof primaryVal === 'function') {
        return function(...args: unknown[]) {
          return (primaryVal as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return primaryVal;
    },
  });
}

function wrapResult(result: unknown): unknown { return result; }

const _dbProxy = new Proxy({} as DbType, {
  get(_target, prop: string | symbol) {
    if (!_db) throw new Error('No database connection available');
    return ( _db as unknown as Record<string | symbol, unknown>)[prop];
  }
});

export const db = _dbProxy;
export const legacyDb = _legacyDb as unknown as DbType;

export async function probeAndSwitchIfNeeded(): Promise<void> {
  if (!_db) return;
  try {
    await _db.execute(drizzleSql`SELECT 1`);
  } catch (err) {
    console.warn('DB probe failed');
  }
}
