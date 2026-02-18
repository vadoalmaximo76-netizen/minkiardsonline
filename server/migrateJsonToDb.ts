import { db, isDatabaseAvailable } from "./db";
import {
  personaggi, customCards as customCardsTable, cardModifications,
  cardSkins, achievements, missionTemplates, tutorialSteps, playerSkins
} from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "server", "data");

function readJson<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️ File not found: ${filename}.json, skipping`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function migratePersonaggi() {
  console.log("1. Migrating personaggi...");
  const jsonData = readJson<any>("personaggiCache");
  if (jsonData.length === 0) return;

  const existing = await db.select({ name: personaggi.name }).from(personaggi);
  const existingNames = new Set(existing.map(e => e.name));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingNames.has(item.name)) {
      try {
        await db.insert(personaggi).values({
          name: item.name,
          pti: item.pti ?? null,
          stars: item.stars ?? null,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting personaggio ${item.name}: ${err.message}`);
        }
      }
    }
  }
  console.log(`  ✅ Personaggi: ${inserted} new, ${existingNames.size} already existed (total JSON: ${jsonData.length})`);
}

async function migrateCardModifications() {
  console.log("2. Migrating card modifications...");
  const jsonData = readJson<any>("cardModifications");
  if (jsonData.length === 0) return;

  const existing = await db.select({ originalCardId: cardModifications.originalCardId }).from(cardModifications);
  const existingIds = new Set(existing.map(e => e.originalCardId));

  let inserted = 0;
  let updated = 0;
  for (const item of jsonData) {
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
        await db.insert(cardModifications).values(values);
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting mod ${item.originalCardId}: ${err.message}`);
        }
      }
    } else {
      try {
        await db.update(cardModifications)
          .set(values)
          .where(eq(cardModifications.originalCardId, item.originalCardId));
        updated++;
      } catch (err: any) {
        console.log(`  ⚠️ Error updating mod ${item.originalCardId}: ${err.message}`);
      }
    }
  }
  console.log(`  ✅ Card modifications: ${inserted} new, ${updated} updated, ${existingIds.size} existed (total JSON: ${jsonData.length})`);
}

async function migrateCustomCards() {
  console.log("3. Migrating custom cards...");
  const jsonData = readJson<any>("customCards");
  if (jsonData.length === 0) return;

  const existing = await db.select({ name: customCardsTable.name }).from(customCardsTable);
  const existingNames = new Set(existing.map(e => e.name));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingNames.has(item.name)) {
      try {
        await db.insert(customCardsTable).values({
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
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting custom card ${item.name}: ${err.message}`);
        }
      }
    }
  }
  console.log(`  ✅ Custom cards: ${inserted} new, ${existingNames.size} already existed (total JSON: ${jsonData.length})`);
}

async function migrateCardSkins() {
  console.log("4. Migrating card skins...");
  const jsonData = readJson<any>("cardSkins");
  if (jsonData.length === 0) return;

  const existing = await db.select({ name: cardSkins.name }).from(cardSkins);
  const existingNames = new Set(existing.map(e => e.name));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingNames.has(item.name)) {
      try {
        await db.insert(cardSkins).values({
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
          rarity: item.rarity ?? "common",
          price: item.price ?? 100,
          isAvailable: item.isAvailable ?? true,
        });
        inserted++;
      } catch (err: any) {
        console.log(`  ⚠️ Error inserting card skin ${item.name}: ${err.message}`);
      }
    }
  }
  console.log(`  ✅ Card skins: ${inserted} new, ${existingNames.size} already existed (total JSON: ${jsonData.length})`);
}

async function migrateAchievements() {
  console.log("5. Migrating achievements...");
  const jsonData = readJson<any>("achievements");
  if (jsonData.length === 0) return;

  const existing = await db.select({ code: achievements.code }).from(achievements);
  const existingCodes = new Set(existing.map(e => e.code));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingCodes.has(item.code)) {
      try {
        await db.insert(achievements).values({
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          icon: item.icon,
          requirement: item.requirement,
          rewardPoints: item.rewardPoints ?? 50,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting achievement ${item.code}: ${err.message}`);
        }
      }
    }
  }
  console.log(`  ✅ Achievements: ${inserted} new, ${existingCodes.size} already existed (total JSON: ${jsonData.length})`);
}

async function migrateMissionTemplates() {
  console.log("6. Migrating mission templates...");
  const jsonData = readJson<any>("missionTemplates");
  if (jsonData.length === 0) return;

  const existing = await db.select({ code: missionTemplates.code }).from(missionTemplates);
  const existingCodes = new Set(existing.map(e => e.code));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingCodes.has(item.code)) {
      try {
        await db.insert(missionTemplates).values({
          code: item.code,
          name: item.name,
          description: item.description,
          type: item.type,
          requirement: item.requirement,
          rewardPoints: item.rewardPoints ?? 20,
          difficulty: item.difficulty ?? "easy",
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting mission ${item.code}: ${err.message}`);
        }
      }
    }
  }
  console.log(`  ✅ Mission templates: ${inserted} new, ${existingCodes.size} already existed (total JSON: ${jsonData.length})`);
}

async function migrateTutorialSteps() {
  console.log("7. Migrating tutorial steps...");
  const jsonData = readJson<any>("tutorialSteps");
  if (jsonData.length === 0) return;

  const existing = await db.select({ stepId: tutorialSteps.stepId }).from(tutorialSteps);
  const existingIds = new Set(existing.map(e => e.stepId));

  let inserted = 0;
  for (const item of jsonData) {
    if (!existingIds.has(item.stepId)) {
      try {
        await db.insert(tutorialSteps).values({
          stepId: item.stepId,
          trigger: item.trigger,
          title: item.title,
          content: item.content,
          sortOrder: item.sortOrder ?? 0,
          isActive: item.isActive ?? true,
        });
        inserted++;
      } catch (err: any) {
        if (!err.message?.includes("duplicate")) {
          console.log(`  ⚠️ Error inserting tutorial step ${item.stepId}: ${err.message}`);
        }
      }
    }
  }
  console.log(`  ✅ Tutorial steps: ${inserted} new, ${existingIds.size} already existed (total JSON: ${jsonData.length})`);
}

async function migratePlayerSkins() {
  console.log("8. Migrating player skins...");
  const jsonData = readJson<any>("playerSkins");
  if (jsonData.length === 0) return;

  const existing = await db.select({ userId: playerSkins.userId, skinId: playerSkins.skinId }).from(playerSkins);
  const existingKeys = new Set(existing.map(e => `${e.userId}-${e.skinId}`));

  let inserted = 0;
  for (const item of jsonData) {
    const key = `${item.userId}-${item.skinId}`;
    if (!existingKeys.has(key)) {
      try {
        await db.insert(playerSkins).values({
          userId: item.userId,
          skinId: item.skinId,
          isEquipped: item.isEquipped ?? false,
        });
        inserted++;
      } catch (err: any) {
        console.log(`  ⚠️ Error inserting player skin ${key}: ${err.message}`);
      }
    }
  }
  console.log(`  ✅ Player skins: ${inserted} new, ${existingKeys.size} already existed (total JSON: ${jsonData.length})`);
}

async function main() {
  if (!isDatabaseAvailable()) {
    console.error("❌ Database is not available. Cannot migrate.");
    process.exit(1);
  }

  console.log("🔄 Starting migration from JSON files to PostgreSQL database...\n");

  try {
    await migratePersonaggi();
    await migrateCardModifications();
    await migrateCustomCards();
    await migrateCardSkins();
    await migrateAchievements();
    await migrateMissionTemplates();
    await migrateTutorialSteps();
    await migratePlayerSkins();

    console.log("\n✅ Migration from JSON to database completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
