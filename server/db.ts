import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Utilizziamo SOLO il driver 'pg' standard. 
// Assicurati che su Render sia impostata la variabile EXTERNAL_DATABASE_URL
const pool = new Pool({
  connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Esportazioni per soddisfare il resto del progetto
export const legacyDb = db; 
export const isDatabaseAvailable = () => !!db;
export const isLegacyDbAvailable = () => true;
export const isUsingFallback = () => false;
export const is402QuotaError = (err: unknown) => false;
export const switchToFallback = () => false;
export const getActiveDbSource = () => 'POSTGRES_DIRECT';
export const getFallbackDb = () => db;
export const getPrimaryDb = () => db;

export async function probeAndSwitchIfNeeded(): Promise<void> {
  console.log('✅ Server starting with Postgres driver');
}
