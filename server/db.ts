import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;
let _isDatabaseAvailable = false;

if (process.env.DATABASE_URL) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
    _isDatabaseAvailable = true;
    console.log('✅ Database connection configured successfully');
  } catch (error) {
    console.warn('⚠️ Database connection failed, running in offline mode:', error);
    _db = null;
    _isDatabaseAvailable = false;
  }
} else {
  console.warn('⚠️ DATABASE_URL not found. Running in offline mode (no database).');
}

export function isDatabaseAvailable(): boolean {
  return _isDatabaseAvailable && _db !== null;
}

export function setDatabaseUnavailable(): void {
  _isDatabaseAvailable = false;
  console.warn('⚠️ Database marked as unavailable due to runtime error');
}

export const db = _db as DbType;
