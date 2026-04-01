import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL });

const migrations = [
  `CREATE TABLE IF NOT EXISTS page_tooltips (
    id SERIAL PRIMARY KEY,
    page_route TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    bg_color TEXT NOT NULL DEFAULT '#1e1b4b',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    size TEXT NOT NULL DEFAULT 'medium',
    image_url TEXT,
    image_position TEXT DEFAULT 'top',
    is_slide BOOLEAN NOT NULL DEFAULT FALSE,
    slides JSONB DEFAULT '[]',
    show_mode TEXT NOT NULL DEFAULT 'always',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS page_tooltips_route_idx ON page_tooltips (page_route)`,
  `ALTER TABLE page_tooltips ALTER COLUMN title SET DEFAULT ''`,
  `ALTER TABLE page_tooltips ALTER COLUMN body SET DEFAULT ''`,
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
console.log('Migration complete: page_tooltips table created.');
