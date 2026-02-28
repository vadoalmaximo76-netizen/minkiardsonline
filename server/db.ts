import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _isDatabaseAvailable = false;
let _activeDbSource: string = 'none';

function sanitizeDbUrl(url: string): string {
  return url.replace(/#/g, '%23');
}

function tryConnect(url: string, label: string): boolean {
  try {
    const sanitizedUrl = sanitizeDbUrl(url);
    const sql = neon(sanitizedUrl);
    _db = drizzle(sql, { schema });
    _isDatabaseAvailable = true;
    _activeDbSource = label;
    console.log(`✅ Database connection configured successfully (source: ${label})`);
    return true;
  } catch (error) {
    console.warn(`⚠️ Database connection failed for ${label}:`, error);
    return false;
  }
}

if (process.env.EXTERNAL_DATABASE_URL) {
  console.log('📡 Using EXTERNAL_DATABASE_URL as primary...');
  if (!tryConnect(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL (primary)')) {
    if (process.env.DATABASE_URL) {
      console.log('🔄 Trying fallback: DATABASE_URL...');
      tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (fallback)');
    }
  }
} else if (process.env.DATABASE_URL) {
  tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (Replit)');
} else {
  console.warn('⚠️ No database URL found. Running in offline mode (no database).');
}

if (!_isDatabaseAvailable) {
  console.warn('⚠️ No database available. Running in offline mode.');
}

export function isDatabaseAvailable(): boolean {
  return _isDatabaseAvailable && _db !== null;
}

export function getActiveDbSource(): string {
  return _activeDbSource;
}

export function setDatabaseUnavailable(): void {
  _isDatabaseAvailable = false;
  console.warn('⚠️ Database marked as unavailable due to runtime error');
}

export const db = _db as unknown as DbType;
