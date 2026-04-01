import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL });

const migrations = [
  `ALTER TABLE user_draft_credits ADD COLUMN IF NOT EXISTS last_daily_card_claim TIMESTAMP`,
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
console.log('Migration complete: last_daily_card_claim column added to user_draft_credits.');
