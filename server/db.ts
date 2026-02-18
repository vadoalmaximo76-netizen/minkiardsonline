import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _isDatabaseAvailable = false;
let _activeDbSource: string = 'none';

function tryConnect(url: string, label: string): boolean {
  try {
    const sql = neon(url);
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

if (process.env.DATABASE_URL) {
  if (!tryConnect(process.env.DATABASE_URL, 'DATABASE_URL (Replit)')) {
    if (process.env.EXTERNAL_DATABASE_URL) {
      console.log('🔄 Trying fallback: EXTERNAL_DATABASE_URL...');
      tryConnect(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL (external)');
    }
  }
} else if (process.env.EXTERNAL_DATABASE_URL) {
  console.log('📡 DATABASE_URL not found, using EXTERNAL_DATABASE_URL...');
  tryConnect(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL (external)');
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
