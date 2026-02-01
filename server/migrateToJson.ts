import { db } from "./db";
import { cardModifications, customCards as customCardsTable, cardSkins } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

async function migrate() {
  console.log("Starting migration from PostgreSQL to JSON...");

  // Migrate card modifications
  console.log("Fetching card modifications...");
  const mods = await db.select().from(cardModifications);
  console.log(`Found ${mods.length} card modifications`);
  
  const modsJson = mods.map(mod => ({
    id: mod.id,
    originalCardId: mod.originalCardId,
    deckType: mod.deckType,
    name: mod.name,
    imageUrl: mod.imageUrl,
    pti: mod.pti,
    stars: mod.stars,
    effect: mod.effect,
    modifiedBy: mod.modifiedBy,
    modifiedAt: mod.modifiedAt?.toISOString(),
    isDeleted: mod.isDeleted,
    audioUrl: mod.audioUrl,
    youtubeUrl: mod.youtubeUrl,
    mosseDamageValue: mod.mosseDamageValue,
    mosseDamageEffect: mod.mosseDamageEffect,
    mosseCharacterOverrides: mod.mosseCharacterOverrides,
    mosseRestrictedFrom: mod.mosseRestrictedFrom,
    mosseRestrictedAgainst: mod.mosseRestrictedAgainst,
    mosseTargetingMode: mod.mosseTargetingMode,
    mosseTargetCount: mod.mosseTargetCount
  }));
  
  fs.writeFileSync(
    path.join(DATA_DIR, "cardModifications.json"),
    JSON.stringify(modsJson, null, 2)
  );
  console.log("Card modifications migrated!");

  // Migrate custom cards
  console.log("Fetching custom cards...");
  const cards = await db.select().from(customCardsTable);
  console.log(`Found ${cards.length} custom cards`);
  
  const cardsJson = cards.map(card => ({
    id: card.id,
    name: card.name,
    deckType: card.deckType,
    imageData: card.imageData,
    pti: card.pti,
    stars: card.stars,
    effect: card.effect,
    audioUrl: card.audioUrl,
    youtubeUrl: card.youtubeUrl,
    mosseDamageValue: card.mosseDamageValue,
    mosseDamageEffect: card.mosseDamageEffect,
    mosseCharacterOverrides: card.mosseCharacterOverrides,
    mosseRestrictedFrom: card.mosseRestrictedFrom,
    mosseRestrictedAgainst: card.mosseRestrictedAgainst,
    mosseTargetingMode: card.mosseTargetingMode,
    mosseTargetCount: card.mosseTargetCount,
    createdBy: card.createdBy,
    createdAt: card.createdAt?.toISOString()
  }));
  
  fs.writeFileSync(
    path.join(DATA_DIR, "customCards.json"),
    JSON.stringify(cardsJson, null, 2)
  );
  console.log("Custom cards migrated!");

  // Migrate card skins
  console.log("Fetching card skins...");
  const skins = await db.select().from(cardSkins);
  console.log(`Found ${skins.length} card skins`);
  
  const skinsJson = skins.map(skin => ({
    id: skin.id,
    originalCardId: skin.originalCardId,
    skinName: skin.skinName,
    skinImageUrl: skin.skinImageUrl,
    skinPti: skin.skinPti,
    skinStars: skin.skinStars,
    createdBy: skin.createdBy,
    createdAt: skin.createdAt?.toISOString()
  }));
  
  fs.writeFileSync(
    path.join(DATA_DIR, "cardSkins.json"),
    JSON.stringify(skinsJson, null, 2)
  );
  console.log("Card skins migrated!");

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
