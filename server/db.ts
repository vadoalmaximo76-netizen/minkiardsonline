import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _fallbackDb: DbType | null = null;
let _isDatabaseAvailable = false;
let _activeDbSource: string = 'none';
let _usingFallback = false;
let _switchCooldownUntil = 0;

let _legacyDb: DbType | null = null;
let _isLegacyDbAvailable = false;

function sanitizeDbUrl(url: string): string {
  return url.replace(/#/g, '%23');
}

function tryConnect(url: string, label: string): DbType | null {
  try {
    const sanitizedUrl = sanitizeDbUrl(url);
    const sql = neon(sanitizedUrl);
    const db = drizzle(sql, { schema });
    console.log(`✅ Database connection configured successfully (source: ${label})`);
    return db;
  } catch (error) {
    console.warn(`⚠️ Database connection failed for ${label}:`, error);
    return null;
  }
}

// ── Initialise connections ──────────────────────────────────────────────────
if (process.env.EXTERNAL_DATABASE_URL) {
  console.log('📡 Using EXTERNAL_DATABASE_URL as primary...');
  const extDb = tryConnect(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL (primary)');
  if (extDb) {
    _db = extDb;
    _isDatabaseAvailable = true;
    _activeDbSource = 'EXTERNAL_DATABASE_URL (primary)';

    if (process.env.DATABASE_URL && process.env.DATABASE_URL !== process.env.EXTERNAL_DATABASE_URL) {
      console.log('📦 Connecting to legacy DATABASE_URL for user migration / fallback...');
      const legDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (legacy/fallback)');
      if (legDb) {
        _legacyDb = legDb;
        _fallbackDb = legDb;
        _isLegacyDbAvailable = true;
      }
    }
  } else {
    if (process.env.DATABASE_URL) {
      console.log('🔄 Trying fallback: DATABASE_URL...');
      const fallbackDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (fallback)');
      if (fallbackDb) {
        _db = fallbackDb;
        _isDatabaseAvailable = true;
        _activeDbSource = 'DATABASE_URL (fallback)';
        _usingFallback = true;
      }
    }
  }
} else if (process.env.DATABASE_URL) {
  const replDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (Replit)');
  if (replDb) {
    _db = replDb;
    _isDatabaseAvailable = true;
    _activeDbSource = 'DATABASE_URL (Replit)';
  }
} else {
  console.warn('⚠️ No database URL found. Running in offline mode (no database).');
}

if (!_isDatabaseAvailable) {
  console.warn('⚠️ No database available. Running in offline mode.');
}

// ── 402 quota-exceeded detection & auto-switch ──────────────────────────────
function is402QuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as any)?.message ?? '';
  return msg.includes('402') || msg.includes('data transfer quota') || msg.includes('exceeded');
}

export function switchToFallback(): boolean {
  if (_usingFallback || !_fallbackDb) return false;
  const now = Date.now();
  if (now < _switchCooldownUntil) return false;
  _switchCooldownUntil = now + 5000; // prevent rapid repeated switches

  console.warn('⚠️ [DB] Switching from primary DB to fallback DATABASE_URL due to quota/error!');
  _db = _fallbackDb;
  _usingFallback = true;
  _isDatabaseAvailable = true;
  _activeDbSource = 'DATABASE_URL (auto-fallback)';
  console.log('✅ [DB] Now using fallback DATABASE_URL (Replit)');
  return true;
}

// Wraps a method result (which may be a thenable/query-builder) to detect 402 errors.
function wrapResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const thenable = result as any;
  if (typeof thenable.then !== 'function') return result;

  const originalThen = thenable.then.bind(thenable);
  thenable.then = function(onFulfilled: any, onRejected: any) {
    return originalThen(onFulfilled, (err: unknown) => {
      if (is402QuotaError(err)) {
        switchToFallback();
      }
      if (onRejected) return onRejected(err);
      return Promise.reject(err);
    });
  };
  return thenable;
}

// ── Dynamic Proxy: always delegates to current _db ──────────────────────────
// The exported `db` reference is always this same Proxy object, so all
// importers automatically see the new _db after switchToFallback().
const _dbProxy = new Proxy({} as DbType, {
  get(_target, prop: string | symbol) {
    if (!_db) throw new Error('No database connection available');
    const currentDb = _db;
    const val = (currentDb as any)[prop];
    if (typeof val === 'function') {
      return function(this: unknown, ...args: unknown[]) {
        const result = (val as Function).apply(currentDb, args);
        return wrapResult(result);
      };
    }
    return val;
  },
  set(_target, prop: string | symbol, value: unknown) {
    if (!_db) return false;
    ((_db) as any)[prop] = value;
    return true;
  },
});

// ── Exports ──────────────────────────────────────────────────────────────────
export const db = _dbProxy;
export const legacyDb = _legacyDb as unknown as DbType;

export function isDatabaseAvailable(): boolean {
  return _isDatabaseAvailable && _db !== null;
}

export function isLegacyDbAvailable(): boolean {
  return _isLegacyDbAvailable && _legacyDb !== null;
}

export function getActiveDbSource(): string {
  return _activeDbSource;
}

export function isUsingFallback(): boolean {
  return _usingFallback;
}

export function setDatabaseUnavailable(): void {
  _isDatabaseAvailable = false;
  console.warn('⚠️ Database marked as unavailable due to runtime error');
}
