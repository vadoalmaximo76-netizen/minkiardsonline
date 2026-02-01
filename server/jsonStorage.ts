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

interface JsonData {
  customCards: CustomCard[];
  cardModifications: CardModification[];
  cardSkins: CardSkin[];
  personaggiCache: PersonaggioCache[];
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
  }
};

export type { CustomCard, CardModification, CardSkin, PersonaggioCache };
