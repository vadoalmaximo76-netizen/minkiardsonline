import { neon } from '@neondatabase/serverless';

async function migrateDb(url, label) {
  if (!url) { console.log(`⚠ Skipping ${label}: not set`); return; }
  const sql = neon(url);
  await sql`ALTER TABLE gym_leaders ADD COLUMN IF NOT EXISTS starter_deck_options JSONB DEFAULT '[]'`;
  const [row] = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gym_leaders' AND column_name = 'starter_deck_options'`;
  console.log(`✓ [${label}] starter_deck_options:`, row);
}

async function migrate() {
  await migrateDb(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL');
  await migrateDb(process.env.DATABASE_URL, 'DATABASE_URL');
  console.log('Migration complete');
}

migrate().catch(e => { console.error('Migration error:', e); process.exit(1); });
