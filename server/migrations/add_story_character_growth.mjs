import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL });

const migrations = [
  `CREATE TABLE IF NOT EXISTS story_character_growth (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    extra_pti INTEGER NOT NULL DEFAULT 0,
    extra_stars INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS story_growth_user_card_idx ON story_character_growth (user_id, card_id)`,
];

for (const sql of migrations) {
  try {
    await pool.query(sql);
    console.log('✓', sql.substring(0, 80));
  } catch (e) {
    console.error('✗', e.message);
  }
}
await pool.end();
console.log('Migration complete: story_character_growth table created.');
