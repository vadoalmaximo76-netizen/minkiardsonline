interface PreviewUrls {
  previewHqMp3: string;
  previewHqOgg: string;
  previewLqMp3: string;
  previewLqOgg: string;
}

interface Sound {
  id: number;
  name: string;
  description: string;
  duration: number;
  url: string;
  previews: PreviewUrls;
  tags: string[];
  avgRating?: number;
  numDownloads?: number;
}

interface SearchResult {
  count: number;
  results: Sound[];
}

// Cache for game sounds to avoid repeated API calls
const gameSoundCache = new Map<string, string | null>();

// Predefined search queries for game sound effects
const GAME_SOUND_QUERIES: Record<string, string> = {
  explosion: 'explosion short impact',
  sword: 'sword slash hit',
  magic: 'magic spell cast',
  victory: 'victory fanfare triumph',
  defeat: 'defeat sad lose',
  card_flip: 'card flip shuffle',
  dice: 'dice roll',
  heal: 'heal cure recovery',
  shield: 'shield barrier protection',
  fire: 'fire burning flame',
  ice: 'ice cold freeze',
  thunder: 'thunder lightning bolt',
  punch: 'punch hit impact',
  coin: 'coin drop money',
};

/**
 * Check if Freesound API is configured
 */
export function isFreesoundConfigured(): boolean {
  return !!process.env.FREESOUND_API_KEY;
}

/**
 * Parse preview URLs from Freesound API response
 */
function parsePreviews(previewsObj: any): PreviewUrls {
  return {
    previewHqMp3: previewsObj['preview-hq-mp3'] || '',
    previewHqOgg: previewsObj['preview-hq-ogg'] || '',
    previewLqMp3: previewsObj['preview-lq-mp3'] || '',
    previewLqOgg: previewsObj['preview-lq-ogg'] || '',
  };
}

/**
 * Parse tags from Freesound API response
 */
function parseTags(tagsArray: any): string[] {
  if (Array.isArray(tagsArray)) {
    return tagsArray.map((tag) => (typeof tag === 'string' ? tag : tag.name || '')).filter(Boolean);
  }
  return [];
}

/**
 * Search for sounds by query
 */
export async function searchSounds(
  query: string,
  options?: {
    page?: number;
    pageSize?: number;
    filter?: string;
    sort?: 'score' | 'duration_asc' | 'duration_desc' | 'created_desc' | 'created_asc' | 'downloads_desc' | 'rating_desc';
  }
): Promise<SearchResult> {
  if (!isFreesoundConfigured()) {
    console.warn('Freesound API is not configured (FREESOUND_API_KEY not set)');
    return { count: 0, results: [] };
  }

  const apiKey = process.env.FREESOUND_API_KEY;
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 15;
  const sort = options?.sort || 'score';

  const params = new URLSearchParams({
    query,
    token: apiKey!,
    fields: 'id,name,description,duration,url,previews,tags,avg_rating,num_downloads',
    page: page.toString(),
    page_size: pageSize.toString(),
    sort,
  });

  if (options?.filter) {
    params.append('filter', options.filter);
  }

  const url = `https://freesound.org/apiv2/search/text/?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Freesound API error: ${response.status} ${response.statusText}`);
      return { count: 0, results: [] };
    }

    const data = await response.json();

    const results: Sound[] = (data.results || []).map((sound: any) => ({
      id: sound.id,
      name: sound.name || '',
      description: sound.description || '',
      duration: sound.duration || 0,
      url: sound.url || '',
      previews: parsePreviews(sound.previews || {}),
      tags: parseTags(sound.tags),
      avgRating: sound.avg_rating || 0,
      numDownloads: sound.num_downloads || 0,
    }));

    return {
      count: data.count || 0,
      results,
    };
  } catch (error) {
    console.error('Error searching Freesound:', error);
    return { count: 0, results: [] };
  }
}

/**
 * Get a specific sound by ID
 */
export async function getSoundById(soundId: number): Promise<Omit<Sound, 'avgRating' | 'numDownloads'> | null> {
  if (!isFreesoundConfigured()) {
    console.warn('Freesound API is not configured (FREESOUND_API_KEY not set)');
    return null;
  }

  const apiKey = process.env.FREESOUND_API_KEY;

  const params = new URLSearchParams({
    token: apiKey!,
    fields: 'id,name,description,duration,url,previews,tags',
  });

  const url = `https://freesound.org/apiv2/sounds/${soundId}/?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Freesound API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const sound = await response.json();

    return {
      id: sound.id,
      name: sound.name || '',
      description: sound.description || '',
      duration: sound.duration || 0,
      url: sound.url || '',
      previews: parsePreviews(sound.previews || {}),
      tags: parseTags(sound.tags),
    };
  } catch (error) {
    console.error(`Error fetching sound ${soundId}:`, error);
    return null;
  }
}

/**
 * Get preview URL for a sound (HQ MP3 preview)
 */
export async function getSoundPreviewUrl(soundId: number): Promise<string | null> {
  const sound = await getSoundById(soundId);

  if (!sound) {
    return null;
  }

  // Return HQ MP3 preview if available, otherwise LQ MP3, otherwise OGG
  return (
    sound.previews.previewHqMp3 ||
    sound.previews.previewLqMp3 ||
    sound.previews.previewHqOgg ||
    sound.previews.previewLqOgg ||
    null
  );
}

/**
 * Search for game-relevant sounds with predefined categories
 * Results are cached in memory to avoid repeated API calls
 */
export async function getGameSound(
  category:
    | 'explosion'
    | 'sword'
    | 'magic'
    | 'victory'
    | 'defeat'
    | 'card_flip'
    | 'dice'
    | 'heal'
    | 'shield'
    | 'fire'
    | 'ice'
    | 'thunder'
    | 'punch'
    | 'coin'
): Promise<string | null> {
  // Check cache first
  if (gameSoundCache.has(category)) {
    return gameSoundCache.get(category) || null;
  }

  const query = GAME_SOUND_QUERIES[category];
  if (!query) {
    console.warn(`Unknown game sound category: ${category}`);
    gameSoundCache.set(category, null);
    return null;
  }

  const result = await searchSounds(query, {
    pageSize: 1,
    sort: 'downloads_desc',
  });

  if (result.results.length === 0) {
    gameSoundCache.set(category, null);
    return null;
  }

  const previewUrl = result.results[0].previews.previewHqMp3 ||
    result.results[0].previews.previewLqMp3 ||
    result.results[0].previews.previewHqOgg ||
    result.results[0].previews.previewLqOgg ||
    null;

  // Cache the result
  gameSoundCache.set(category, previewUrl);

  return previewUrl;
}
