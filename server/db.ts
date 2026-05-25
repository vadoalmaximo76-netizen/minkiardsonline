import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Usiamo una variabile d'ambiente pulita. 
// Assicurati che su Render sia impostata solo EXTERNAL_DATABASE_URL
const connString = process.env.EXTERNAL_DATABASE_URL || "";

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Esportazioni "dummy" per far compilare il resto
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
