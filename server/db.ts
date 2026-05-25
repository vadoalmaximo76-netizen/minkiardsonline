import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Connessione diretta
const pool = new Pool({
  connectionString: process.env.EXTERNAL_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Esportazioni necessarie per far contenti auth.ts e routes.ts
export const legacyDb = db; 
export const isDatabaseAvailable = () => !!db;
export const isLegacyDbAvailable = () => true;
export const isUsingFallback = () => false;
export const is402QuotaError = (err: unknown) => false;
export const switchToFallback = () => false;
export const getActiveDbSource = () => 'EXTERNAL_DATABASE_URL/Supabase (direct)';

export async function probeAndSwitchIfNeeded(): Promise<void> {
  try {
    await db.execute(require('drizzle-orm').sql`SELECT 1`);
    console.log('✅ Database connected successfully');
  } catch (e) {
    console.error('❌ Database connection failed', e);
  }
}
