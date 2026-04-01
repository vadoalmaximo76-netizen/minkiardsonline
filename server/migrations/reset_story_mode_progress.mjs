import { neon } from '@neondatabase/serverless';

async function resetStoryMode(url, label) {
  if (!url) { console.log(`⚠ Skipping ${label}: not set`); return; }
  const sql = neon(url);

  const [gymBefore] = await sql`SELECT COUNT(*) AS count FROM user_gym_progress`;
  const [deckBefore] = await sql`SELECT COUNT(*) AS count FROM user_story_deck`;
  const [injuredBefore] = await sql`SELECT COUNT(*) AS count FROM injured_personaggi`;
  console.log(`[${label}] Before reset — user_gym_progress: ${gymBefore.count}, user_story_deck: ${deckBefore.count}, injured_personaggi: ${injuredBefore.count}`);

  await sql`DELETE FROM user_gym_progress`;
  await sql`DELETE FROM user_story_deck`;
  await sql`DELETE FROM injured_personaggi`;

  const [gymAfter] = await sql`SELECT COUNT(*) AS count FROM user_gym_progress`;
  const [deckAfter] = await sql`SELECT COUNT(*) AS count FROM user_story_deck`;
  const [injuredAfter] = await sql`SELECT COUNT(*) AS count FROM injured_personaggi`;
  console.log(`✓ [${label}] After reset — user_gym_progress: ${gymAfter.count}, user_story_deck: ${deckAfter.count}, injured_personaggi: ${injuredAfter.count}`);
}

async function migrate() {
  await resetStoryMode(process.env.EXTERNAL_DATABASE_URL, 'EXTERNAL_DATABASE_URL');
  await resetStoryMode(process.env.DATABASE_URL, 'DATABASE_URL');
  console.log('Story Mode reset complete');
}

migrate().catch(e => { console.error('Reset error:', e); process.exit(1); });
