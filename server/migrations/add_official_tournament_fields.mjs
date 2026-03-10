import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL });

const migrations = [
  `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS note TEXT`,
  `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_24h BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_1h BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_30m BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMP`,
  `ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS disqualification_reason TEXT`,
];

for (const sql of migrations) {
  try {
    await pool.query(sql);
    console.log('✓', sql.substring(0, 60));
  } catch (e) {
    console.error('✗', e.message);
  }
}
await pool.end();
console.log('Migration complete.');
