import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  await sql`ALTER TABLE gym_leaders ADD COLUMN IF NOT EXISTS starter_deck_options JSONB DEFAULT '[]'`;
  console.log('✓ starter_deck_options column added to gym_leaders');
  const [row] = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gym_leaders' AND column_name = 'starter_deck_options'`;
  console.log('Migration complete:', row);
}

migrate().catch(e => { console.error('Migration error:', e); process.exit(1); });
