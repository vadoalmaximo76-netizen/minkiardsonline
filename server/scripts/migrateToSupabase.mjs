import pg from 'pg';
const { Pool } = pg;

const REPLIT_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.EXTERNAL_DATABASE_URL;

if (!REPLIT_URL || !SUPABASE_URL) {
  console.error('Missing DATABASE_URL or EXTERNAL_DATABASE_URL');
  process.exit(1);
}

const src = new Pool({ connectionString: REPLIT_URL, ssl: { rejectUnauthorized: false } });
const dst = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

const TABLES = [
  'users', 'personaggi', 'card_skins', 'card_modifications', 'custom_cards',
  'achievements', 'mission_templates', 'tutorial_steps', 'training_tips',
  'player_skins', 'matches', 'game_events', 'game_states',
  'player_achievements', 'player_daily_missions',
  'friend_requests', 'friendships', 'game_invitations',
  'clans', 'clan_members', 'clan_join_requests',
  'tournaments', 'tournament_participants', 'tournament_matches',
  'seasonal_events', 'seasonal_cards', 'seasonal_passes', 'pass_rewards', 'player_pass_progress',
  'conversations', 'private_messages', 'push_subscriptions', 'notifications',
  'card_collection', 'user_card_collection',
  'user_draft_credits', 'draft_decks', 'credit_purchases',
  'draft_pack_openings', 'draft_deck_presets', 'draft_character_growth',
  'story_character_growth', 'card_trade_listings', 'card_trade_history',
  'draft_tournaments', 'gym_leaders', 'user_gym_progress', 'user_story_deck',
  'injured_personaggi', 'daily_challenge_scores', 'page_tooltips'
];

const BATCH = 200;

async function getPrimaryKey(table) {
  const r = await dst.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ORDER BY kcu.ordinal_position LIMIT 1
  `, [table]);
  return r.rows[0]?.column_name;
}

async function migrateTable(table) {
  let srcRows;
  try {
    const r = await src.query(`SELECT * FROM "${table}"`);
    srcRows = r.rows;
  } catch(e) {
    console.log(`  ⚠️  ${table}: lettura sorgente fallita — ${e.message.slice(0, 80)}`);
    return { ok: false, rows: 0 };
  }
  if (srcRows.length === 0) {
    console.log(`  ⏩ ${table}: 0 righe`);
    return { ok: true, rows: 0 };
  }

  const pk = await getPrimaryKey(table);
  const cols = Object.keys(srcRows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');
  const conflictClause = pk && cols.includes(pk) ? `("${pk}") DO NOTHING` : `DO NOTHING`;

  let inserted = 0;
  for (let i = 0; i < srcRows.length; i += BATCH) {
    const batch = srcRows.slice(i, i + BATCH);
    const vals = batch.map((_, bi) =>
      `(${cols.map((__, ci) => `$${bi * cols.length + ci + 1}`).join(', ')})`
    ).join(', ');
    const flat = batch.flatMap(row => cols.map(c => row[c]));
    try {
      const res = await dst.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${vals} ON CONFLICT ${conflictClause}`,
        flat
      );
      inserted += res.rowCount ?? batch.length;
    } catch(e) {
      for (const row of batch) {
        const sVals = `(${cols.map((_, i) => `$${i+1}`).join(', ')})`;
        const flat2 = cols.map(c => row[c]);
        try {
          await dst.query(`INSERT INTO "${table}" (${colList}) VALUES ${sVals} ON CONFLICT ${conflictClause}`, flat2);
          inserted++;
        } catch(_) {}
      }
    }
  }
  console.log(`  ✅ ${table}: ${inserted}/${srcRows.length} righe`);
  return { ok: true, rows: inserted };
}

async function main() {
  console.log('🚀 Migrazione Replit → Supabase...\n');
  const t0 = Date.now();
  let totalRows = 0, okCount = 0, failCount = 0;
  for (const table of TABLES) {
    const r = await migrateTable(table);
    if (r.ok) { okCount++; totalRows += r.rows; }
    else failCount++;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🏁 Fine in ${secs}s — ${okCount} tabelle OK, ${failCount} errori, ${totalRows} righe totali`);
  await src.end();
  await dst.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
