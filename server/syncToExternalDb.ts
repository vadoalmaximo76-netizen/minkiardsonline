import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');

function sanitizeDbUrl(url: string): string {
  return url.replace(/#/g, '%23');
}

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
  const sanitizedUrl = sanitizeDbUrl(extUrl);
  const sql = neon(sanitizedUrl);
  const extDb = drizzle(sql, { schema });

  console.log('✅ Connected to external database\n');
  console.log('🔄 Syncing data from JSON files to external database...\n');

  try {
    console.log('1. Syncing personaggi...');
    const personaggiData = readJson<any>('personaggiCache');
    if (personaggiData.length > 0) {
      const existing = await extDb.select({ name: schema.personaggi.name }).from(schema.personaggi);
      const existingNames = new Set(existing.map(e => e.name));
      let inserted = 0;
      for (const item of personaggiData) {
        if (!existingNames.has(item.name)) {
          try {
            await extDb.insert(schema.personaggi).values({
              name: item.name,
              pti: item.pti ?? null,
              stars: item.stars ?? null,
            });
            inserted++;
          } catch (err: any) {}
        }
      }
      console.log(`  ✅ Personaggi: ${inserted} new, ${existingNames.size} already existed (total JSON: ${personaggiData.length})`);
    }

    console.log('2. Syncing card modifications...');
    const modsData = readJson<any>('cardModifications');
    if (modsData.length > 0) {
      const existing = await extDb.select({ originalCardId: schema.cardModifications.originalCardId }).from(schema.cardModifications);
      const existingIds = new Set(existing.map(e => e.originalCardId));
      let inserted = 0, updated = 0;
      for (const item of modsData) {
        const values: any = {
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
        };
        if (!existingIds.has(item.originalCardId)) {
          try {
            await extDb.insert(schema.cardModifications).values(values);
            inserted++;
          } catch (err: any) {}
        } else {
          try {
            await extDb.update(schema.cardModifications)
              .set(values)
              .where(eq(schema.cardModifications.originalCardId, item.originalCardId));
            updated++;
          } catch (err: any) {}
        }
      }
      console.log(`  ✅ Card modifications: ${inserted} new, ${updated} updated (total JSON: ${modsData.length})`);
    }

    console.log('3. Syncing custom cards...');
    const customData = readJson<any>('customCards');
    if (customData.length > 0) {
      const existing = await extDb.select({ name: schema.customCards.name }).from(schema.customCards);
      const existingNames = new Set(existing.map(e => e.name));
      let inserted = 0;
      for (const item of customData) {
        if (!existingNames.has(item.name)) {
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
          } catch (err: any) {}
        }
      }
      console.log(`  ✅ Custom cards: ${inserted} new, ${existingNames.size} already existed (total JSON: ${customData.length})`);
    }

    console.log('4. Syncing card skins...');
    const skinsData = readJson<any>('cardSkins');
    if (skinsData.length > 0) {
      const existing = await extDb.select({ name: schema.cardSkins.name }).from(schema.cardSkins);
      const existingNames = new Set(existing.map(e => e.name));
      let inserted = 0;
      for (const item of skinsData) {
        if (!existingNames.has(item.name)) {
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
      }
      console.log(`  ✅ Card skins: ${inserted} new, ${existingNames.size} already existed (total JSON: ${skinsData.length})`);
    }

    console.log('5. Syncing achievements...');
    const achievementsData = readJson<any>('achievements');
    if (achievementsData.length > 0) {
      const existing = await extDb.select({ code: schema.achievements.code }).from(schema.achievements);
      const existingCodes = new Set(existing.map(e => e.code));
      let inserted = 0;
      for (const item of achievementsData) {
        if (!existingCodes.has(item.code)) {
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
      }
      console.log(`  ✅ Achievements: ${inserted} new, ${existingCodes.size} already existed (total JSON: ${achievementsData.length})`);
    }

    console.log('6. Syncing mission templates...');
    const missionsData = readJson<any>('missionTemplates');
    if (missionsData.length > 0) {
      const existing = await extDb.select({ code: schema.missionTemplates.code }).from(schema.missionTemplates);
      const existingCodes = new Set(existing.map(e => e.code));
      let inserted = 0;
      for (const item of missionsData) {
        if (!existingCodes.has(item.code)) {
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
      }
      console.log(`  ✅ Mission templates: ${inserted} new, ${existingCodes.size} already existed (total JSON: ${missionsData.length})`);
    }

    console.log('7. Syncing tutorial steps...');
    const tutorialData = readJson<any>('tutorialSteps');
    if (tutorialData.length > 0) {
      const existing = await extDb.select({ stepId: schema.tutorialSteps.stepId }).from(schema.tutorialSteps);
      const existingIds = new Set(existing.map(e => e.stepId));
      let inserted = 0;
      for (const item of tutorialData) {
        if (!existingIds.has(item.stepId)) {
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
      }
      console.log(`  ✅ Tutorial steps: ${inserted} new, ${existingIds.size} already existed (total JSON: ${tutorialData.length})`);
    }

    console.log('8. Syncing player skins...');
    const playerSkinsData = readJson<any>('playerSkins');
    if (playerSkinsData.length > 0) {
      const existing = await extDb.select({ userId: schema.playerSkins.userId, skinId: schema.playerSkins.skinId }).from(schema.playerSkins);
      const existingKeys = new Set(existing.map(e => `${e.userId}-${e.skinId}`));
      let inserted = 0;
      for (const item of playerSkinsData) {
        const key = `${item.userId}-${item.skinId}`;
        if (!existingKeys.has(key)) {
          try {
            await extDb.insert(schema.playerSkins).values({
              userId: item.userId,
              skinId: item.skinId,
              isEquipped: item.isEquipped ?? false,
            });
            inserted++;
          } catch (err: any) {}
        }
      }
      console.log(`  ✅ Player skins: ${inserted} new, ${existingKeys.size} already existed (total JSON: ${playerSkinsData.length})`);
    }

    console.log('\n✅ External database sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
