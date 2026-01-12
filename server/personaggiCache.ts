import { db } from './db';
import { personaggi } from '../shared/schema';

export const personaggiCache = new Map<string, { pti: number | null, stars: number | null, name: string }>();
export let personaggiCacheLoaded = false;

export async function loadPersonaggiCache(): Promise<void> {
  if (personaggiCacheLoaded) return;
  
  try {
    console.log('📦 Loading PERSONAGGI cache from database...');
    const allPersonaggi = await db.select().from(personaggi);
    
    for (const p of allPersonaggi) {
      if (p.name) {
        const normalizedName = p.name.toLowerCase().replace(/[-_]/g, ' ').trim();
        personaggiCache.set(normalizedName, { pti: p.pti, stars: p.stars, name: p.name });
        personaggiCache.set(p.name.toUpperCase(), { pti: p.pti, stars: p.stars, name: p.name });
      }
    }
    
    personaggiCacheLoaded = true;
    console.log(`📦 PERSONAGGI cache loaded: ${personaggiCache.size} entries`);
  } catch (error) {
    console.error('Error loading PERSONAGGI cache:', error);
  }
}

export function getPersonaggioFromCache(cardName: string): { pti: number | null, stars: number | null } | null {
  const normalizedName = cardName.toLowerCase().replace(/[-_]/g, ' ').trim();
  
  let cached = personaggiCache.get(normalizedName);
  if (cached) {
    return { pti: cached.pti, stars: cached.stars };
  }
  
  cached = personaggiCache.get(cardName.toUpperCase());
  if (cached) {
    return { pti: cached.pti, stars: cached.stars };
  }
  
  const entries = Array.from(personaggiCache.entries());
  for (const [key, value] of entries) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return { pti: value.pti, stars: value.stars };
    }
  }
  
  return null;
}

export function isCacheReady(): boolean {
  return personaggiCacheLoaded;
}
