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
      console.log('📦 Connecting to DATABASE_URL as secondary (dual-write + fallback)...');
      const legDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (secondary/fallback)');
      if (legDb) {
        _legacyDb = legDb;
        _fallbackDb = legDb;
        _isLegacyDbAvailable = true;
        console.log('🔁 Dual-write enabled: writes go to BOTH primary and secondary DB');
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

// ── Dual-write builder ──────────────────────────────────────────────────────
// Creates a proxy around a Drizzle query builder that, when awaited, also
// fires the same query on the secondary DB in the background (errors silently
// swallowed so they never affect the primary result).
function createDualBuilder(primaryBuilder: any, secondaryBuilder: any | null): any {
  return new Proxy(primaryBuilder, {
    get(target, prop) {
      // When the query is awaited (.then is called), execute both DBs
      if (prop === 'then') {
        return function(onFulfilled: any, onRejected: any) {
          // Fire secondary in background — do NOT await
          if (secondaryBuilder && typeof secondaryBuilder.then === 'function') {
            Promise.resolve(secondaryBuilder).catch((err: unknown) => {
              // Silently ignore secondary failures (schema mismatch, downtime…)
              const msg = (err as any)?.message ?? String(err);
              console.warn('[DualWrite] Secondary DB write failed (ignored):', msg.slice(0, 120));
            });
          }
          // Return primary result normally
          return target.then(onFulfilled, onRejected);
        };
      }

      // For builder chain methods (.values, .where, .set, .returning, etc.)
      // forward the same call to both builders and return a new dual builder.
      const primaryVal = target[prop];
      if (typeof primaryVal === 'function') {
        return function(...args: any[]) {
          const newPrimary = primaryVal.apply(target, args);
          let newSecondary: any = null;
          if (secondaryBuilder) {
            try {
              const secMethod = secondaryBuilder[prop];
              if (typeof secMethod === 'function') {
                newSecondary = secMethod.apply(secondaryBuilder, args);
              }
            } catch (_e) {
              newSecondary = null;
            }
          }
          // Wrap in a new dual builder so chain continues on both
          if (newPrimary && typeof newPrimary === 'object') {
            return createDualBuilder(newPrimary, newSecondary);
          }
          return newPrimary;
        };
      }

      return primaryVal;
    },
  });
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
// Write operations (insert/update/delete) are dual-written to _fallbackDb
// when it is a DIFFERENT instance from _db (i.e. not in fallback mode yet).
const WRITE_OPS = new Set(['insert', 'update', 'delete']);

const _dbProxy = new Proxy({} as DbType, {
  get(_target, prop: string | symbol) {
    if (!_db) throw new Error('No database connection available');
    const currentDb = _db;
    const val = (currentDb as any)[prop];

    if (typeof val === 'function') {
      return function(this: unknown, ...args: unknown[]) {
        const primaryResult = (val as Function).apply(currentDb, args);

        // ── Dual-write for INSERT / UPDATE / DELETE ──────────────────────
        const isWrite = WRITE_OPS.has(prop as string);
        if (isWrite && _fallbackDb && _fallbackDb !== currentDb) {
          try {
            const secMethod = (_fallbackDb as any)[prop];
            if (typeof secMethod === 'function') {
              const secondaryResult = (secMethod as Function).apply(_fallbackDb, args);
              // Return a dual builder that propagates chain calls to both
              return createDualBuilder(primaryResult, secondaryResult);
            }
          } catch (_e) {
            // If secondary setup fails, fall through to primary only
          }
        }

        // Default: wrap primary result (detects 402 in reads/writes without secondary)
        return wrapResult(primaryResult);
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

// Returns the raw fallback DB instance (used for sync-databases admin endpoint)
export function getFallbackDb(): DbType | null {
  return _fallbackDb;
}

// Returns the raw primary DB instance (used for sync-databases admin endpoint)
export function getPrimaryDb(): DbType | null {
  // When in fallback mode, _db IS the fallback; return the original primary (no separate reference kept)
  if (_usingFallback) return null;
  return _db;
}
