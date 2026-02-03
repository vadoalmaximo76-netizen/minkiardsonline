import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');

interface CustomCard {
  id: number;
  name: string;
  deckType: string;
  imageData: string;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  youtubeUrl: string | null;
  mosseDamageValue: number | null;
  mosseDamageEffect: string | null;
  mosseCharacterOverrides: any[] | null;
  mosseRestrictedFrom: string[] | null;
  mosseRestrictedAgainst: string[] | null;
  mosseTargetingMode: string | null;
  mosseTargetCount: number | null;
  mosseCanCounter: boolean;
  mosseCanBeCountered: boolean;
  createdBy: string | null;
  createdAt: string;
}

interface CardModification {
  id: number;
  originalCardId: string;
  deckType: string;
  name: string | null;
  imageUrl: string | null;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  youtubeUrl: string | null;
  mosseDamageValue: number | null;
  mosseDamageEffect: string | null;
  mosseCharacterOverrides: any[] | null;
  mosseRestrictedFrom: string[] | null;
  mosseRestrictedAgainst: string[] | null;
  mosseTargetingMode: string | null;
  mosseTargetCount: number | null;
  mosseCanCounter: boolean;
  mosseCanBeCountered: boolean;
  isDeleted: boolean;
  modifiedBy: string | null;
  modifiedAt: string;
}

interface CardSkin {
  id: number;
  name: string;
  cardName: string | null;
  cardType: string | null;
  description: string | null;
  borderStyle: string | null;
  backgroundGradient: string | null;
  glowColor: string | null;
  frameImageUrl: string | null;
  skinImageUrl: string | null;
  skinPti: number | null;
  skinStars: number | null;
  rarity: string;
  price: number;
  isAvailable: boolean;
  createdAt: string;
}

interface PersonaggioCache {
  id: number;
  name: string;
  pti: number | null;
  stars: number | null;
}

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement: number;
  rewardPoints: number;
  createdAt: string;
}

interface MissionTemplate {
  id: number;
  code: string;
  name: string;
  description: string;
  type: string;
  requirement: number;
  rewardPoints: number;
  difficulty: string;
}

interface TutorialStep {
  id: number;
  stepId: string;
  trigger: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlayerSkin {
  id: number;
  userId: number;
  skinId: number;
  isEquipped: boolean;
  purchasedAt: string;
}

interface JsonData {
  customCards: CustomCard[];
  cardModifications: CardModification[];
  cardSkins: CardSkin[];
  personaggiCache: PersonaggioCache[];
  achievements: Achievement[];
  missionTemplates: MissionTemplate[];
  tutorialSteps: TutorialStep[];
  playerSkins: PlayerSkin[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(type: keyof JsonData): string {
  return path.join(DATA_DIR, `${type}.json`);
}

function readJsonFile<T>(type: keyof JsonData): T[] {
  ensureDataDir();
  const filePath = getFilePath(type);
  
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
    return [];
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${type}.json:`, error);
    return [];
  }
}

function writeJsonFile<T>(type: keyof JsonData, data: T[]): void {
  ensureDataDir();
  const filePath = getFilePath(type);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${type}.json:`, error);
    throw error;
  }
}

function getNextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map(item => item.id)) + 1;
}

export const jsonStorage = {
  customCards: {
    getAll(): CustomCard[] {
      return readJsonFile<CustomCard>('customCards');
    },
    
    getByDeckType(deckType: string): CustomCard[] {
      return this.getAll().filter(card => card.deckType === deckType);
    },
    
    getById(id: number): CustomCard | undefined {
      return this.getAll().find(card => card.id === id);
    },
    
    create(data: Omit<CustomCard, 'id' | 'createdAt'>): CustomCard {
      const cards = this.getAll();
      const newCard: CustomCard = {
        ...data,
        id: getNextId(cards),
        createdAt: new Date().toISOString()
      };
      cards.push(newCard);
      writeJsonFile('customCards', cards);
      console.log(`[JSON] Created custom card: ${newCard.name} (ID: ${newCard.id})`);
      return newCard;
    },
    
    update(id: number, data: Partial<Omit<CustomCard, 'id' | 'createdAt'>>): CustomCard | null {
      const cards = this.getAll();
      const index = cards.findIndex(card => card.id === id);
      if (index === -1) return null;
      
      cards[index] = { ...cards[index], ...data };
      writeJsonFile('customCards', cards);
      console.log(`[JSON] Updated custom card ID: ${id}`);
      return cards[index];
    },
    
    delete(id: number): boolean {
      const cards = this.getAll();
      const index = cards.findIndex(card => card.id === id);
      if (index === -1) return false;
      
      cards.splice(index, 1);
      writeJsonFile('customCards', cards);
      console.log(`[JSON] Deleted custom card ID: ${id}`);
      return true;
    }
  },
  
  cardModifications: {
    getAll(): CardModification[] {
      return readJsonFile<CardModification>('cardModifications');
    },
    
    getByOriginalCardId(originalCardId: string): CardModification | undefined {
      return this.getAll().find(mod => mod.originalCardId === originalCardId);
    },
    
    getById(id: number): CardModification | undefined {
      return this.getAll().find(mod => mod.id === id);
    },
    
    create(data: Omit<CardModification, 'id' | 'modifiedAt'>): CardModification {
      const mods = this.getAll();
      const newMod: CardModification = {
        ...data,
        id: getNextId(mods),
        modifiedAt: new Date().toISOString()
      };
      mods.push(newMod);
      writeJsonFile('cardModifications', mods);
      console.log(`[JSON] Created card modification for: ${newMod.originalCardId}`);
      return newMod;
    },
    
    upsert(originalCardId: string, data: Partial<Omit<CardModification, 'id' | 'modifiedAt'>>): CardModification {
      const mods = this.getAll();
      const existingIndex = mods.findIndex(mod => mod.originalCardId === originalCardId);
      
      if (existingIndex !== -1) {
        mods[existingIndex] = {
          ...mods[existingIndex],
          ...data,
          modifiedAt: new Date().toISOString()
        };
        writeJsonFile('cardModifications', mods);
        console.log(`[JSON] Updated card modification for: ${originalCardId}`);
        return mods[existingIndex];
      } else {
        const newMod: CardModification = {
          id: getNextId(mods),
          originalCardId,
          deckType: data.deckType || 'mosse',
          name: data.name || null,
          imageUrl: data.imageUrl || null,
          pti: data.pti ?? null,
          stars: data.stars ?? null,
          effect: data.effect || null,
          audioUrl: data.audioUrl || null,
          youtubeUrl: data.youtubeUrl || null,
          mosseDamageValue: data.mosseDamageValue ?? null,
          mosseDamageEffect: data.mosseDamageEffect || null,
          mosseCharacterOverrides: data.mosseCharacterOverrides || null,
          mosseRestrictedFrom: data.mosseRestrictedFrom || null,
          mosseRestrictedAgainst: data.mosseRestrictedAgainst || null,
          mosseTargetingMode: data.mosseTargetingMode || null,
          mosseTargetCount: data.mosseTargetCount ?? null,
          mosseCanCounter: data.mosseCanCounter ?? false,
          mosseCanBeCountered: data.mosseCanBeCountered ?? false,
          isDeleted: data.isDeleted ?? false,
          modifiedBy: data.modifiedBy || null,
          modifiedAt: new Date().toISOString()
        };
        mods.push(newMod);
        writeJsonFile('cardModifications', mods);
        console.log(`[JSON] Created card modification for: ${originalCardId}`);
        return newMod;
      }
    },
    
    delete(id: number): boolean {
      const mods = this.getAll();
      const index = mods.findIndex(mod => mod.id === id);
      if (index === -1) return false;
      
      mods.splice(index, 1);
      writeJsonFile('cardModifications', mods);
      console.log(`[JSON] Deleted card modification ID: ${id}`);
      return true;
    },
    
    deleteByOriginalCardId(originalCardId: string): boolean {
      const mods = this.getAll();
      const index = mods.findIndex(mod => mod.originalCardId === originalCardId);
      if (index === -1) return false;
      
      mods.splice(index, 1);
      writeJsonFile('cardModifications', mods);
      console.log(`[JSON] Deleted card modification for: ${originalCardId}`);
      return true;
    }
  },
  
  cardSkins: {
    getAll(): CardSkin[] {
      return readJsonFile<CardSkin>('cardSkins');
    },
    
    getAvailable(): CardSkin[] {
      return this.getAll().filter(skin => skin.isAvailable);
    },
    
    getByCardName(cardName: string): CardSkin[] {
      return this.getAll().filter(skin => 
        skin.cardName?.toLowerCase() === cardName.toLowerCase()
      );
    },
    
    getById(id: number): CardSkin | undefined {
      return this.getAll().find(skin => skin.id === id);
    },
    
    create(data: Omit<CardSkin, 'id' | 'createdAt'>): CardSkin {
      const skins = this.getAll();
      const newSkin: CardSkin = {
        ...data,
        id: getNextId(skins),
        createdAt: new Date().toISOString()
      };
      skins.push(newSkin);
      writeJsonFile('cardSkins', skins);
      console.log(`[JSON] Created skin: ${newSkin.name} (ID: ${newSkin.id})`);
      return newSkin;
    },
    
    update(id: number, data: Partial<Omit<CardSkin, 'id' | 'createdAt'>>): CardSkin | null {
      const skins = this.getAll();
      const index = skins.findIndex(skin => skin.id === id);
      if (index === -1) return null;
      
      skins[index] = { ...skins[index], ...data };
      writeJsonFile('cardSkins', skins);
      console.log(`[JSON] Updated skin ID: ${id}`);
      return skins[index];
    },
    
    delete(id: number): boolean {
      const skins = this.getAll();
      const index = skins.findIndex(skin => skin.id === id);
      if (index === -1) return false;
      
      skins.splice(index, 1);
      writeJsonFile('cardSkins', skins);
      console.log(`[JSON] Deleted skin ID: ${id}`);
      return true;
    }
  },
  
  personaggiCache: {
    getAll(): PersonaggioCache[] {
      return readJsonFile<PersonaggioCache>('personaggiCache');
    },
    
    getByName(name: string): PersonaggioCache | undefined {
      return this.getAll().find(p => 
        p.name.toLowerCase() === name.toLowerCase()
      );
    },
    
    setAll(data: PersonaggioCache[]): void {
      writeJsonFile('personaggiCache', data);
      console.log(`[JSON] Saved ${data.length} personaggi to cache`);
    },
    
    add(data: Omit<PersonaggioCache, 'id'>): PersonaggioCache {
      const cache = this.getAll();
      
      // Check for existing entry to prevent duplicates
      const existingIndex = cache.findIndex(p => p.name.toLowerCase() === data.name.toLowerCase());
      if (existingIndex !== -1) {
        // Update existing entry instead of adding duplicate
        cache[existingIndex] = { ...cache[existingIndex], pti: data.pti, stars: data.stars };
        writeJsonFile('personaggiCache', cache);
        console.log(`[JSON] Updated existing cache entry: ${data.name}`);
        return cache[existingIndex];
      }
      
      const newEntry: PersonaggioCache = {
        ...data,
        id: getNextId(cache)
      };
      cache.push(newEntry);
      writeJsonFile('personaggiCache', cache);
      console.log(`[JSON] Added to cache: ${newEntry.name}`);
      return newEntry;
    },
    
    update(name: string, data: Partial<Omit<PersonaggioCache, 'id' | 'name'>>): PersonaggioCache | null {
      const cache = this.getAll();
      const index = cache.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      if (index === -1) return null;
      
      cache[index] = { ...cache[index], ...data };
      writeJsonFile('personaggiCache', cache);
      console.log(`[JSON] Updated cache: ${name}`);
      return cache[index];
    }
  },

  achievements: {
    getAll(): Achievement[] {
      return readJsonFile<Achievement>('achievements');
    },
    
    getByCode(code: string): Achievement | undefined {
      return this.getAll().find(a => a.code === code);
    },
    
    getById(id: number): Achievement | undefined {
      return this.getAll().find(a => a.id === id);
    },
    
    getByCategory(category: string): Achievement[] {
      return this.getAll().filter(a => a.category === category);
    },
    
    create(data: Omit<Achievement, 'id' | 'createdAt'>): Achievement {
      const achievements = this.getAll();
      const newAchievement: Achievement = {
        ...data,
        id: getNextId(achievements),
        createdAt: new Date().toISOString()
      };
      achievements.push(newAchievement);
      writeJsonFile('achievements', achievements);
      console.log(`[JSON] Created achievement: ${newAchievement.name}`);
      return newAchievement;
    },
    
    update(id: number, data: Partial<Omit<Achievement, 'id' | 'createdAt'>>): Achievement | null {
      const achievements = this.getAll();
      const index = achievements.findIndex(a => a.id === id);
      if (index === -1) return null;
      
      achievements[index] = { ...achievements[index], ...data };
      writeJsonFile('achievements', achievements);
      console.log(`[JSON] Updated achievement ID: ${id}`);
      return achievements[index];
    },
    
    delete(id: number): boolean {
      const achievements = this.getAll();
      const index = achievements.findIndex(a => a.id === id);
      if (index === -1) return false;
      
      achievements.splice(index, 1);
      writeJsonFile('achievements', achievements);
      console.log(`[JSON] Deleted achievement ID: ${id}`);
      return true;
    }
  },

  missionTemplates: {
    getAll(): MissionTemplate[] {
      return readJsonFile<MissionTemplate>('missionTemplates');
    },
    
    getByCode(code: string): MissionTemplate | undefined {
      return this.getAll().find(m => m.code === code);
    },
    
    getById(id: number): MissionTemplate | undefined {
      return this.getAll().find(m => m.id === id);
    },
    
    getByDifficulty(difficulty: string): MissionTemplate[] {
      return this.getAll().filter(m => m.difficulty === difficulty);
    },
    
    getByType(type: string): MissionTemplate[] {
      return this.getAll().filter(m => m.type === type);
    },
    
    create(data: Omit<MissionTemplate, 'id'>): MissionTemplate {
      const missions = this.getAll();
      const newMission: MissionTemplate = {
        ...data,
        id: getNextId(missions)
      };
      missions.push(newMission);
      writeJsonFile('missionTemplates', missions);
      console.log(`[JSON] Created mission template: ${newMission.name}`);
      return newMission;
    },
    
    update(id: number, data: Partial<Omit<MissionTemplate, 'id'>>): MissionTemplate | null {
      const missions = this.getAll();
      const index = missions.findIndex(m => m.id === id);
      if (index === -1) return null;
      
      missions[index] = { ...missions[index], ...data };
      writeJsonFile('missionTemplates', missions);
      console.log(`[JSON] Updated mission template ID: ${id}`);
      return missions[index];
    },
    
    delete(id: number): boolean {
      const missions = this.getAll();
      const index = missions.findIndex(m => m.id === id);
      if (index === -1) return false;
      
      missions.splice(index, 1);
      writeJsonFile('missionTemplates', missions);
      console.log(`[JSON] Deleted mission template ID: ${id}`);
      return true;
    }
  },

  tutorialSteps: {
    getAll(): TutorialStep[] {
      return readJsonFile<TutorialStep>('tutorialSteps');
    },
    
    getActive(): TutorialStep[] {
      return this.getAll().filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    
    getByStepId(stepId: string): TutorialStep | undefined {
      return this.getAll().find(s => s.stepId === stepId);
    },
    
    getById(id: number): TutorialStep | undefined {
      return this.getAll().find(s => s.id === id);
    },
    
    getByTrigger(trigger: string): TutorialStep[] {
      return this.getAll().filter(s => s.trigger === trigger && s.isActive);
    },
    
    create(data: Omit<TutorialStep, 'id' | 'createdAt' | 'updatedAt'>): TutorialStep {
      const steps = this.getAll();
      const now = new Date().toISOString();
      const newStep: TutorialStep = {
        ...data,
        id: getNextId(steps),
        createdAt: now,
        updatedAt: now
      };
      steps.push(newStep);
      writeJsonFile('tutorialSteps', steps);
      console.log(`[JSON] Created tutorial step: ${newStep.title}`);
      return newStep;
    },
    
    update(id: number, data: Partial<Omit<TutorialStep, 'id' | 'createdAt'>>): TutorialStep | null {
      const steps = this.getAll();
      const index = steps.findIndex(s => s.id === id);
      if (index === -1) return null;
      
      steps[index] = { ...steps[index], ...data, updatedAt: new Date().toISOString() };
      writeJsonFile('tutorialSteps', steps);
      console.log(`[JSON] Updated tutorial step ID: ${id}`);
      return steps[index];
    },
    
    delete(id: number): boolean {
      const steps = this.getAll();
      const index = steps.findIndex(s => s.id === id);
      if (index === -1) return false;
      
      steps.splice(index, 1);
      writeJsonFile('tutorialSteps', steps);
      console.log(`[JSON] Deleted tutorial step ID: ${id}`);
      return true;
    }
  },

  playerSkins: {
    getAll(): PlayerSkin[] {
      return readJsonFile<PlayerSkin>('playerSkins');
    },
    
    getByUserId(userId: number): PlayerSkin[] {
      return this.getAll().filter(s => s.userId === userId);
    },
    
    getEquipped(userId: number): PlayerSkin | undefined {
      return this.getAll().find(s => s.userId === userId && s.isEquipped);
    },
    
    getById(id: number): PlayerSkin | undefined {
      return this.getAll().find(s => s.id === id);
    },
    
    create(data: Omit<PlayerSkin, 'id' | 'purchasedAt'>): PlayerSkin {
      const skins = this.getAll();
      const newSkin: PlayerSkin = {
        ...data,
        id: getNextId(skins),
        purchasedAt: new Date().toISOString()
      };
      skins.push(newSkin);
      writeJsonFile('playerSkins', skins);
      console.log(`[JSON] Created player skin for user ${newSkin.userId}`);
      return newSkin;
    },
    
    update(id: number, data: Partial<Omit<PlayerSkin, 'id' | 'purchasedAt'>>): PlayerSkin | null {
      const skins = this.getAll();
      const index = skins.findIndex(s => s.id === id);
      if (index === -1) return null;
      
      skins[index] = { ...skins[index], ...data };
      writeJsonFile('playerSkins', skins);
      console.log(`[JSON] Updated player skin ID: ${id}`);
      return skins[index];
    },
    
    equipSkin(userId: number, skinId: number): boolean {
      const skins = this.getAll();
      let found = false;
      
      // Unequip all skins for this user, equip the target
      skins.forEach(skin => {
        if (skin.userId === userId) {
          if (skin.skinId === skinId) {
            skin.isEquipped = true;
            found = true;
          } else {
            skin.isEquipped = false;
          }
        }
      });
      
      if (found) {
        writeJsonFile('playerSkins', skins);
        console.log(`[JSON] Equipped skin ${skinId} for user ${userId}`);
      }
      return found;
    },
    
    delete(id: number): boolean {
      const skins = this.getAll();
      const index = skins.findIndex(s => s.id === id);
      if (index === -1) return false;
      
      skins.splice(index, 1);
      writeJsonFile('playerSkins', skins);
      console.log(`[JSON] Deleted player skin ID: ${id}`);
      return true;
    }
  }
};

export type { CustomCard, CardModification, CardSkin, PersonaggioCache, Achievement, MissionTemplate, TutorialStep, PlayerSkin };
