import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL });

const migrations = [
  `ALTER TABLE gym_leaders ADD COLUMN IF NOT EXISTS use_fixed_deck_order BOOLEAN NOT NULL DEFAULT FALSE`,
];

try {
  for (const migration of migrations) {
    await pool.query(migration);
    console.log('✅ Migration applied:', migration.substring(0, 60) + '...');
  }
  console.log('✅ All migrations applied successfully');
} catch (err) {
  console.error('❌ Migration error:', err.message);
} finally {
  await pool.end();
}
