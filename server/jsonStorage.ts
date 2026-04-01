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
  attackLowAudioUrl: string | null;
  attackHighAudioUrl: string | null;
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
  attackLowAudioUrl: string | null;
  attackHighAudioUrl: string | null;
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
  evolvesInto: string | null;
  evolutionVariants: { [key: string]: string } | null;
  transformsInto: string | null;
  transformsFrom: string | null;
  cheatsInto: string | null;
  specialCategory: string | null;
  evolvedMoves: any | null;
  superAttacco: any | null;
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

interface JsonUser {
  id: number;
  username: string;
  email: string | null;
  password: string | null;
  googleId: string | null;
  avatar: string;
  puntiRankiard: number;
  isAdmin: boolean;
  resetPasswordToken: string | null;
  resetPasswordExpires: string | null;
  createdAt: string;
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
  users: JsonUser[];
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

    replaceAll(data: CustomCard[]): void {
      writeJsonFile('customCards', data);
      console.log(`[JSON] Replaced all custom cards: ${data.length} entries`);
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

    replaceAll(data: CardModification[]): void {
      writeJsonFile('cardModifications', data);
      console.log(`[JSON] Replaced all card modifications: ${data.length} entries`);
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
          attackLowAudioUrl: data.attackLowAudioUrl || null,
          attackHighAudioUrl: data.attackHighAudioUrl || null,
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
          evolvesInto: data.evolvesInto || null,
          evolutionVariants: data.evolutionVariants || null,
          transformsInto: data.transformsInto || null,
          transformsFrom: data.transformsFrom || null,
          cheatsInto: data.cheatsInto || null,
          specialCategory: data.specialCategory || null,
          evolvedMoves: data.evolvedMoves || null,
          superAttacco: data.superAttacco || null,
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

    replaceAll(data: CardSkin[]): void {
      writeJsonFile('cardSkins', data);
      console.log(`[JSON] Replaced all card skins: ${data.length} entries`);
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

    replaceAll(data: Achievement[]): void {
      writeJsonFile('achievements', data);
      console.log(`[JSON] Replaced all achievements: ${data.length} entries`);
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

    replaceAll(data: MissionTemplate[]): void {
      writeJsonFile('missionTemplates', data);
      console.log(`[JSON] Replaced all mission templates: ${data.length} entries`);
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

    replaceAll(data: TutorialStep[]): void {
      writeJsonFile('tutorialSteps', data);
      console.log(`[JSON] Replaced all tutorial steps: ${data.length} entries`);
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
  },

  users: {
    getAll(): JsonUser[] {
      return readJsonFile<JsonUser>('users');
    },

    getById(id: number): JsonUser | undefined {
      return this.getAll().find(u => u.id === id);
    },

    getByEmail(email: string): JsonUser | undefined {
      return this.getAll().find(u => u.email?.toLowerCase() === email.toLowerCase());
    },

    getByUsername(username: string): JsonUser | undefined {
      return this.getAll().find(u => u.username.toLowerCase() === username.toLowerCase());
    },

    getByGoogleId(googleId: string): JsonUser | undefined {
      return this.getAll().find(u => u.googleId === googleId);
    },

    getByResetToken(token: string): JsonUser | undefined {
      return this.getAll().find(u => u.resetPasswordToken === token);
    },

    create(data: Omit<JsonUser, 'id' | 'createdAt'>): JsonUser {
      const allUsers = this.getAll();
      const newUser: JsonUser = {
        ...data,
        id: getNextId(allUsers),
        createdAt: new Date().toISOString()
      };
      allUsers.push(newUser);
      writeJsonFile('users', allUsers);
      console.log(`[JSON] Created user: ${newUser.username} (ID: ${newUser.id})`);
      return newUser;
    },

    update(id: number, data: Partial<Omit<JsonUser, 'id' | 'createdAt'>>): JsonUser | null {
      const allUsers = this.getAll();
      const index = allUsers.findIndex(u => u.id === id);
      if (index === -1) return null;

      allUsers[index] = { ...allUsers[index], ...data };
      writeJsonFile('users', allUsers);
      console.log(`[JSON] Updated user ID: ${id}`);
      return allUsers[index];
    }
  },

  packs: {
    getAll(): PackConfig[] {
      const stored = readJsonFile<PackConfig>('packs');
      return stored.length > 0 ? stored : DEFAULT_PACKS;
    },
    save(packs: PackConfig[]): void {
      ensureDataDir();
      writeJsonFile('packs', packs);
    },
    create(data: Omit<PackConfig, 'id'> & { id?: string }): PackConfig {
      const all = this.getAll();
      const newPack: PackConfig = {
        ...data,
        id: data.id || `pack-${Date.now()}`,
        cardCount: data.slots.length,
      };
      all.push(newPack);
      this.save(all);
      return newPack;
    },
    update(id: string, data: Partial<PackConfig>): PackConfig | null {
      const all = this.getAll();
      const index = all.findIndex(p => p.id === id);
      if (index === -1) return null;
      if (data.slots) data.cardCount = data.slots.length;
      all[index] = { ...all[index], ...data };
      this.save(all);
      return all[index];
    },
    delete(id: string): boolean {
      const all = this.getAll();
      const filtered = all.filter(p => p.id !== id);
      if (filtered.length === all.length) return false;
      this.save(filtered);
      return true;
    },
  },

  cardVersion: {
    getFilePath(): string {
      return path.join(DATA_DIR, 'cardVersion.json');
    },
    
    get(): { version: number; updatedAt: string; note?: string } | null {
      const filePath = this.getFilePath();
      if (!fs.existsSync(filePath)) {
        return { version: 1, updatedAt: new Date().toISOString() };
      }
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        return { version: 1, updatedAt: new Date().toISOString() };
      }
    },
    
    set(data: { version: number; updatedAt: string; note?: string }): void {
      ensureDataDir();
      const filePath = this.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[JSON] Card version updated to: ${data.version}`);
    }
  }
};

export interface PackSlot {
  rarity?: string;
  alternatives?: { rarity: string; weight: number }[];
  deckType?: string;
}

export interface PackConfig {
  id: string;
  name: string;
  creditsRequired: number;
  cardCount: number;
  description: string;
  gradient: string;
  glowColor: string;
  imageUrl?: string;
  textColor?: string;
  slots: PackSlot[];
}

const DEFAULT_PACKS: PackConfig[] = [
  {
    id: 'bronzo', name: 'Pacchetto Bronzo', creditsRequired: 75, cardCount: 5,
    description: 'Il pacchetto base per iniziare la tua collezione',
    gradient: 'linear-gradient(135deg, #92400e, #b45309, #d97706)', glowColor: '#b45309',
    imageUrl: 'https://i.ibb.co/5W0W5WKJ/1.png',
    slots: [
      { rarity: 'comune' }, { rarity: 'comune' }, { rarity: 'comune' }, { rarity: 'rara' },
      { alternatives: [{ rarity: 'epica', weight: 90 }, { rarity: 'leggendaria', weight: 10 }] },
    ],
  },
  {
    id: 'argento', name: 'Pacchetto Argento', creditsRequired: 150, cardCount: 7,
    description: 'Più carte rare per ampliare il tuo mazzo',
    gradient: 'linear-gradient(135deg, #374151, #6b7280, #9ca3af)', glowColor: '#9ca3af',
    imageUrl: 'https://i.ibb.co/p6Cbt7fd/2.png',
    slots: [
      { rarity: 'comune' }, { rarity: 'comune' },
      { rarity: 'rara' }, { rarity: 'rara' }, { rarity: 'rara' },
      { rarity: 'epica' },
      { alternatives: [{ rarity: 'epica', weight: 90 }, { rarity: 'leggendaria', weight: 10 }] },
    ],
  },
  {
    id: 'oro', name: 'Pacchetto Oro', creditsRequired: 300, cardCount: 10,
    description: 'Carte potenti con possibilità di leggendarie',
    gradient: 'linear-gradient(135deg, #78350f, #d97706, #fbbf24)', glowColor: '#f59e0b',
    imageUrl: 'https://i.ibb.co/cSnZnh3Z/3.png',
    slots: [
      { rarity: 'comune' }, { rarity: 'comune' }, { rarity: 'comune' },
      { rarity: 'rara' }, { rarity: 'rara' }, { rarity: 'rara' }, { rarity: 'rara' },
      { rarity: 'epica' }, { rarity: 'epica' }, { rarity: 'leggendaria' },
    ],
  },
  {
    id: 'diamante', name: 'Pacchetto Diamante', creditsRequired: 500, cardCount: 12,
    description: 'Le carte più potenti del gioco garantite',
    gradient: 'linear-gradient(135deg, #1e3a5f, #1d4ed8, #38bdf8)', glowColor: '#38bdf8',
    imageUrl: 'https://i.ibb.co/CK6FB73q/4.png',
    slots: [
      { rarity: 'comune' }, { rarity: 'comune' },
      { rarity: 'rara' }, { rarity: 'rara' }, { rarity: 'rara' }, { rarity: 'rara' },
      { rarity: 'epica' }, { rarity: 'epica' }, { rarity: 'epica' }, { rarity: 'epica' },
      { rarity: 'leggendaria' }, { rarity: 'leggendaria' },
    ],
  },
  {
    id: 'personaggi', name: 'Pacchetto Personaggi', creditsRequired: 50, cardCount: 3,
    description: 'Tre personaggi casuali tra comuni e rari',
    gradient: 'linear-gradient(135deg, #064e3b, #065f46, #059669)', glowColor: '#059669',
    imageUrl: 'https://i.ibb.co/Kc2qY7ST/5.png',
    slots: [
      { rarity: 'comune', deckType: 'personaggi' },
      { rarity: 'comune', deckType: 'personaggi' },
      { alternatives: [{ rarity: 'comune', weight: 50 }, { rarity: 'rara', weight: 50 }], deckType: 'personaggi' },
    ],
  },
  {
    id: 'mosse', name: 'Pacchetto Mosse', creditsRequired: 50, cardCount: 3,
    description: 'Tre mosse casuali tra comuni e rare',
    gradient: 'linear-gradient(135deg, #1e3a5f, #1e40af, #3b82f6)', glowColor: '#3b82f6',
    imageUrl: 'https://i.ibb.co/p6T4dK4S/6.png',
    slots: [
      { rarity: 'comune', deckType: 'mosse' },
      { rarity: 'comune', deckType: 'mosse' },
      { alternatives: [{ rarity: 'comune', weight: 50 }, { rarity: 'rara', weight: 50 }], deckType: 'mosse' },
    ],
  },
  {
    id: 'bonus', name: 'Pacchetto Bonus', creditsRequired: 50, cardCount: 3,
    description: 'Tre bonus casuali tra comuni e rari',
    gradient: 'linear-gradient(135deg, #7c2d12, #c2410c, #f97316)', glowColor: '#f97316',
    imageUrl: 'https://i.ibb.co/RGbhJgwR/7.png',
    slots: [
      { rarity: 'comune', deckType: 'bonus' },
      { rarity: 'comune', deckType: 'bonus' },
      { alternatives: [{ rarity: 'comune', weight: 50 }, { rarity: 'rara', weight: 50 }], deckType: 'bonus' },
    ],
  },
  {
    id: 'personaggi_speciali', name: 'Pacchetto Personaggi Speciali', creditsRequired: 50, cardCount: 3,
    description: 'Tre personaggi speciali casuali tra rari ed epici',
    gradient: 'linear-gradient(135deg, #3b0764, #7c3aed, #a855f7)', glowColor: '#a855f7',
    imageUrl: 'https://i.ibb.co/99MRvfBX/8.png',
    slots: [
      { alternatives: [{ rarity: 'rara', weight: 60 }, { rarity: 'epica', weight: 40 }], deckType: 'personaggi' },
      { alternatives: [{ rarity: 'rara', weight: 60 }, { rarity: 'epica', weight: 40 }], deckType: 'personaggi' },
      { alternatives: [{ rarity: 'epica', weight: 70 }, { rarity: 'leggendaria', weight: 30 }], deckType: 'personaggi' },
    ],
  },
];

export interface HomePanel {
  id: string;
  panelKey: string;
  title: string;
  subtitle: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  titleColor: string;
  subtitleColor: string;
  badge: string;
  badgeColor: string;
  sortOrder: number;
  adminOnly: boolean;
}

export const newsTickerStorage = {
  DEFAULT_QUOTES: [
    "⚡ Viva il Pelux",
    "🎮 Entra nel vivo del gioco scegliendo la sezione che preferisci",
    "✨ Lo sapevi che puoi comprare skin speciali per le tue carte? Vai su PROFILO e scegli SKIN CARTE",
    "📖 Vuoi capire meglio il meccanismo? Vai su ALLENAMENTO e premi REGOLAMENTO per non avere più dubbi!",
    "🏆 FantaMinkiards: costruisci la tua squadra e sfida gli amici nel torneo!",
    "📬 Minkiards è un progetto indipendente nato nel 2012 — vadoalmaximo76@gmail.com"
  ],
  get(): string[] {
    const file = path.join(DATA_DIR, 'newsTicker.json');
    try {
      if (!fs.existsSync(file)) return this.DEFAULT_QUOTES;
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) && data.length > 0 ? data : this.DEFAULT_QUOTES;
    } catch { return this.DEFAULT_QUOTES; }
  },
  save(quotes: string[]): void {
    const file = path.join(DATA_DIR, 'newsTicker.json');
    fs.writeFileSync(file, JSON.stringify(quotes, null, 2));
  },
};

export const homePanelsStorage = {
  getAll(): HomePanel[] {
    const file = path.join(DATA_DIR, 'homePanels.json');
    try {
      if (!fs.existsSync(file)) return [];
      return JSON.parse(fs.readFileSync(file, 'utf8')) as HomePanel[];
    } catch { return []; }
  },
  save(panels: HomePanel[]): void {
    const file = path.join(DATA_DIR, 'homePanels.json');
    fs.writeFileSync(file, JSON.stringify(panels, null, 2));
  },
};

export const homeConfigStorage = {
  DEFAULTS: {
    rankSectionVisible: true,
    rankSectionPosition: 'above' as 'above' | 'below',
    rankSectionLabel: 'Il tuo rango',
    statsGridVisible: true,
    ctaText: 'GIOCA ORA',
    ctaSubtext: 'Guadagna Rankiard',
    ctaGradientFrom: '#22c55e',
    ctaGradientTo: '#16a34a',
  },
  get() {
    const file = path.join(DATA_DIR, 'homeConfig.json');
    try {
      if (!fs.existsSync(file)) return { ...this.DEFAULTS };
      return { ...this.DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch { return { ...this.DEFAULTS }; }
  },
  save(config: any): void {
    const file = path.join(DATA_DIR, 'homeConfig.json');
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
  },
};

export const rankiardTiersStorage = {
  DEFAULTS: [
    { name: 'Esordiente',  min: 0,    numeral: 'I'   },
    { name: 'Dilettante',  min: 300,  numeral: 'II'  },
    { name: 'Competitore', min: 600,  numeral: 'III' },
    { name: 'Sfidante',    min: 1000, numeral: 'IV'  },
    { name: 'Campione',    min: 1500, numeral: 'V'   },
    { name: 'Maestro',     min: 2000, numeral: 'VI'  },
    { name: 'Leggenda',    min: 2500, numeral: '★'   },
  ],
  get() {
    const file = path.join(DATA_DIR, 'rankiardTiers.json');
    try {
      if (!fs.existsSync(file)) return [...this.DEFAULTS];
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) && data.length > 0 ? data : [...this.DEFAULTS];
    } catch { return [...this.DEFAULTS]; }
  },
  save(tiers: any[]): void {
    const file = path.join(DATA_DIR, 'rankiardTiers.json');
    fs.writeFileSync(file, JSON.stringify(tiers, null, 2));
  },
};

export type { CustomCard, CardModification, CardSkin, PersonaggioCache, Achievement, MissionTemplate, TutorialStep, PlayerSkin, JsonUser };
