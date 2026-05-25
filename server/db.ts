import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Connessione diretta e semplice senza Proxy o logiche complesse
const pool = new Pool({
  connectionString: process.env.EXTERNAL_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export function isDatabaseAvailable(): boolean {
  return !!db;
}

export function getActiveDbSource(): string {
  return 'EXTERNAL_DATABASE_URL/Supabase (direct)';
}

export async function probeAndSwitchIfNeeded(): Promise<void> {
  try {
    await db.execute(require('drizzle-orm').sql`SELECT 1`);
    console.log('✅ Database connected successfully');
  } catch (e) {
    console.error('❌ Database connection failed', e);
  }
}

export function isUsingFallback(): boolean { return false; }
export function is402QuotaError(err: unknown): boolean { return false; }
export function switchToFallback(): boolean { return false; }
