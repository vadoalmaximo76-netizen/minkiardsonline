import { db } from "./db";
import { 
  cardModifications, customCards as customCardsTable, cardSkins, personaggi,
  tutorialSteps, achievements, missionTemplates, playerSkins
} from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function migrate() {
  ensureDir(DATA_DIR);
  console.log("Starting FULL migration from PostgreSQL to JSON...\n");

  // 1. Card Modifications
  console.log("1. Fetching card modifications...");
  const mods = await db.select().from(cardModifications);
  console.log(`   Found ${mods.length} card modifications`);
  fs.writeFileSync(path.join(DATA_DIR, "cardModifications.json"), JSON.stringify(mods, null, 2));

  // 2. Custom Cards
  console.log("2. Fetching custom cards...");
  const cards = await db.select().from(customCardsTable);
  console.log(`   Found ${cards.length} custom cards`);
  fs.writeFileSync(path.join(DATA_DIR, "customCards.json"), JSON.stringify(cards, null, 2));

  // 3. Card Skins
  console.log("3. Fetching card skins...");
  const skins = await db.select().from(cardSkins);
  console.log(`   Found ${skins.length} card skins`);
  fs.writeFileSync(path.join(DATA_DIR, "cardSkins.json"), JSON.stringify(skins, null, 2));

  // 4. Personaggi Cache
  console.log("4. Fetching personaggi...");
  const personaggiData = await db.select().from(personaggi);
  console.log(`   Found ${personaggiData.length} personaggi`);
  fs.writeFileSync(path.join(DATA_DIR, "personaggiCache.json"), JSON.stringify(personaggiData, null, 2));

  // 5. Tutorial Steps
  console.log("5. Fetching tutorial steps...");
  const tutorials = await db.select().from(tutorialSteps);
  console.log(`   Found ${tutorials.length} tutorial steps`);
  fs.writeFileSync(path.join(DATA_DIR, "tutorialSteps.json"), JSON.stringify(tutorials, null, 2));

  // 6. Achievements
  console.log("6. Fetching achievements...");
  const achievementsData = await db.select().from(achievements);
  console.log(`   Found ${achievementsData.length} achievements`);
  fs.writeFileSync(path.join(DATA_DIR, "achievements.json"), JSON.stringify(achievementsData, null, 2));

  // 7. Mission Templates
  console.log("7. Fetching mission templates...");
  const missions = await db.select().from(missionTemplates);
  console.log(`   Found ${missions.length} mission templates`);
  fs.writeFileSync(path.join(DATA_DIR, "missionTemplates.json"), JSON.stringify(missions, null, 2));

  // 8. Player Skins
  console.log("8. Fetching player skins...");
  const playerSkinsData = await db.select().from(playerSkins);
  console.log(`   Found ${playerSkinsData.length} player skins`);
  fs.writeFileSync(path.join(DATA_DIR, "playerSkins.json"), JSON.stringify(playerSkinsData, null, 2));

  console.log("\n✅ FULL Migration complete!");
  console.log(`   Files saved to: ${DATA_DIR}`);
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
