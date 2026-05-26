import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Usa solo pg, escludendo totalmente qualsiasi cosa legata a Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Esportazioni standard
export const legacyDb = db;
export const isDatabaseAvailable = () => true;
export const isLegacyDbAvailable = () => true;
export const isUsingFallback = () => false;
export const is402QuotaError = (err: unknown) => false;
export const switchToFallback = () => false;
export const getActiveDbSource = () => 'POSTGRES_DIRECT';
export const getFallbackDb = () => db;
export const getPrimaryDb = () => db;

export async function probeAndSwitchIfNeeded(): Promise<void> {
  console.log('✅ Server running on Postgres');
}
