import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _isDatabaseAvailable = false;
let _activeDbSource: string = 'none';

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

if (process.env.EXTERNAL_DATABASE_URL) {
  console.log('📡 Using EXTERNAL_DATABASE_URL as primary...');
  const extDb = tryConnect(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL (primary)');
  if (extDb) {
    _db = extDb;
    _isDatabaseAvailable = true;
    _activeDbSource = 'EXTERNAL_DATABASE_URL (primary)';

    // Connect legacy DB (old Replit Neon DB) for user migration only if different URL
    if (process.env.DATABASE_URL && process.env.DATABASE_URL !== process.env.EXTERNAL_DATABASE_URL) {
      console.log('📦 Connecting to legacy DATABASE_URL for user migration...');
      const legDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (legacy/migration)');
      if (legDb) {
        _legacyDb = legDb;
        _isLegacyDbAvailable = true;
      }
    }
  } else {
    // Fallback to Replit DB
    if (process.env.DATABASE_URL) {
      console.log('🔄 Trying fallback: DATABASE_URL...');
      const fallbackDb = tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (fallback)');
      if (fallbackDb) {
        _db = fallbackDb;
        _isDatabaseAvailable = true;
        _activeDbSource = 'DATABASE_URL (fallback)';
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

export function isDatabaseAvailable(): boolean {
  return _isDatabaseAvailable && _db !== null;
}

export function isLegacyDbAvailable(): boolean {
  return _isLegacyDbAvailable && _legacyDb !== null;
}

export function getActiveDbSource(): string {
  return _activeDbSource;
}

export function setDatabaseUnavailable(): void {
  _isDatabaseAvailable = false;
  console.warn('⚠️ Database marked as unavailable due to runtime error');
}

export const db = _db as unknown as DbType;
export const legacyDb = _legacyDb as unknown as DbType;
