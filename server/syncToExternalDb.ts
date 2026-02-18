import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');

function readJson<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️ File not found: ${filename}.json, skipping`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const extUrl = process.env.EXTERNAL_DATABASE_URL;
  if (!extUrl) {
    console.error('❌ EXTERNAL_DATABASE_URL not set. Cannot sync.');
    process.exit(1);
  }

  console.log('📡 Connecting to external database...');
  const sql = neon(extUrl);
  const extDb = drizzle(sql, { schema });

  console.log('✅ Connected to external database\n');
  console.log('🔄 Syncing data from JSON files to external database...\n');

  try {
    console.log('1. Syncing personaggi...');
    const personaggiData = readJson<any>('personaggiCache');
    let inserted = 0;
    for (const item of personaggiData) {
      try {
        await extDb.insert(schema.personaggi).values({
          name: item.name,
          pti: item.pti ?? null,
          stars: item.stars ?? null,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes('duplicate') && !err.message?.includes('unique')) {
        }
      }
    }
    console.log(`  ✅ Personaggi: ${inserted} synced (total: ${personaggiData.length})`);

    console.log('2. Syncing card modifications...');
    const modsData = readJson<any>('cardModifications');
    inserted = 0;
    for (const item of modsData) {
      try {
        await extDb.insert(schema.cardModifications).values({
          originalCardId: item.originalCardId,
          deckType: item.deckType,
          name: item.name ?? null,
          imageUrl: item.imageUrl ?? null,
          pti: item.pti ?? null,
          stars: item.stars ?? null,
          effect: item.effect ?? null,
          audioUrl: item.audioUrl ?? null,
          youtubeUrl: item.youtubeUrl ?? null,
          mosseDamageValue: item.mosseDamageValue ?? null,
          mosseDamageEffect: item.mosseDamageEffect ?? null,
          mosseCharacterOverrides: item.mosseCharacterOverrides ?? null,
          mosseRestrictedFrom: item.mosseRestrictedFrom ?? null,
          mosseRestrictedAgainst: item.mosseRestrictedAgainst ?? null,
          mosseTargetingMode: item.mosseTargetingMode ?? null,
          mosseTargetCount: item.mosseTargetCount ?? null,
          mosseCanCounter: item.mosseCanCounter ?? false,
          mosseCanBeCountered: item.mosseCanBeCountered ?? false,
          isDeleted: item.isDeleted ?? false,
          modifiedBy: item.modifiedBy ?? null,
          evolvesInto: item.evolvesInto ?? null,
          transformsInto: item.transformsInto ?? null,
          transformsFrom: item.transformsFrom ?? null,
          cheatsInto: item.cheatsInto ?? null,
          specialCategory: item.specialCategory ?? null,
          evolvedMoves: item.evolvedMoves ?? null,
          superAttacco: item.superAttacco ?? null,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes('duplicate') && !err.message?.includes('unique')) {
        }
      }
    }
    console.log(`  ✅ Card modifications: ${inserted} synced (total: ${modsData.length})`);

    console.log('3. Syncing custom cards...');
    const customData = readJson<any>('customCards');
    inserted = 0;
    for (const item of customData) {
      try {
        await extDb.insert(schema.customCards).values({
          name: item.name,
          deckType: item.deckType,
          imageData: item.imageData,
          pti: item.pti ?? null,
          stars: item.stars ?? null,
          effect: item.effect ?? null,
          audioUrl: item.audioUrl ?? null,
          youtubeUrl: item.youtubeUrl ?? null,
          mosseDamageValue: item.mosseDamageValue ?? null,
          mosseDamageEffect: item.mosseDamageEffect ?? null,
          mosseCharacterOverrides: item.mosseCharacterOverrides ?? null,
          mosseRestrictedFrom: item.mosseRestrictedFrom ?? null,
          mosseRestrictedAgainst: item.mosseRestrictedAgainst ?? null,
          mosseTargetingMode: item.mosseTargetingMode ?? null,
          mosseTargetCount: item.mosseTargetCount ?? null,
          mosseCanCounter: item.mosseCanCounter ?? false,
          mosseCanBeCountered: item.mosseCanBeCountered ?? false,
          createdBy: item.createdBy ?? null,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes('duplicate') && !err.message?.includes('unique')) {
        }
      }
    }
    console.log(`  ✅ Custom cards: ${inserted} synced (total: ${customData.length})`);

    console.log('4. Syncing card skins...');
    const skinsData = readJson<any>('cardSkins');
    inserted = 0;
    for (const item of skinsData) {
      try {
        await extDb.insert(schema.cardSkins).values({
          name: item.name,
          cardName: item.cardName ?? null,
          cardType: item.cardType ?? null,
          description: item.description ?? null,
          borderStyle: item.borderStyle ?? null,
          backgroundGradient: item.backgroundGradient ?? null,
          glowColor: item.glowColor ?? null,
          frameImageUrl: item.frameImageUrl ?? null,
          skinImageUrl: item.skinImageUrl ?? null,
          skinPti: item.skinPti ?? null,
          skinStars: item.skinStars ?? null,
          rarity: item.rarity ?? 'common',
          price: item.price ?? 100,
          isAvailable: item.isAvailable ?? true,
        });
        inserted++;
      } catch (err: any) {}
    }
    console.log(`  ✅ Card skins: ${inserted} synced (total: ${skinsData.length})`);

    console.log('5. Syncing achievements...');
    const achievementsData = readJson<any>('achievements');
    inserted = 0;
    for (const item of achievementsData) {
      try {
        await extDb.insert(schema.achievements).values({
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          icon: item.icon,
          requirement: item.requirement,
          rewardPoints: item.rewardPoints ?? 50,
        });
        inserted++;
      } catch (err: any) {}
    }
    console.log(`  ✅ Achievements: ${inserted} synced (total: ${achievementsData.length})`);

    console.log('6. Syncing mission templates...');
    const missionsData = readJson<any>('missionTemplates');
    inserted = 0;
    for (const item of missionsData) {
      try {
        await extDb.insert(schema.missionTemplates).values({
          code: item.code,
          name: item.name,
          description: item.description,
          type: item.type,
          requirement: item.requirement,
          rewardPoints: item.rewardPoints ?? 20,
          difficulty: item.difficulty ?? 'easy',
        });
        inserted++;
      } catch (err: any) {}
    }
    console.log(`  ✅ Mission templates: ${inserted} synced (total: ${missionsData.length})`);

    console.log('7. Syncing tutorial steps...');
    const tutorialData = readJson<any>('tutorialSteps');
    inserted = 0;
    for (const item of tutorialData) {
      try {
        await extDb.insert(schema.tutorialSteps).values({
          stepId: item.stepId,
          trigger: item.trigger,
          title: item.title,
          content: item.content,
          sortOrder: item.sortOrder ?? 0,
          isActive: item.isActive ?? true,
        });
        inserted++;
      } catch (err: any) {}
    }
    console.log(`  ✅ Tutorial steps: ${inserted} synced (total: ${tutorialData.length})`);

    console.log('\n✅ External database sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
