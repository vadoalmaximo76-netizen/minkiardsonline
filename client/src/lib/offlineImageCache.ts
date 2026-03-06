const IMAGE_CACHE_NAME = 'minkiards-images-v1';
const OFFLINE_KEY = 'minkiards_offline_images';
const BATCH_SIZE = 8;

export function isOfflineCacheSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

export function isOfflineCacheEnabled(): boolean {
  return localStorage.getItem(OFFLINE_KEY) === 'complete';
}

export async function getAllCardImageUrls(): Promise<string[]> {
  const res = await fetch('/api/all-card-images');
  if (!res.ok) throw new Error('Errore nel recupero lista immagini');
  const data = await res.json();
  return data.urls as string[];
}

export async function downloadAllCardImages(
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!isOfflineCacheSupported()) throw new Error('Cache API non supportata su questo browser');

  const urls = await getAllCardImageUrls();
  const total = urls.length;
  const cache = await caches.open(IMAGE_CACHE_NAME);

  let done = 0;
  onProgress(0, total);

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Download annullato', 'AbortError');

    const batch = urls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const response = await fetch(url, { mode: 'cors', signal });
            if (response.ok) {
              await cache.put(url, response);
            }
          }
        } catch (_) {}
        done++;
        onProgress(done, total);
      })
    );
  }

  localStorage.setItem(OFFLINE_KEY, 'complete');
}

export async function getOfflineStats(): Promise<{ cached: number; total: number; enabled: boolean }> {
  if (!isOfflineCacheSupported()) return { cached: 0, total: 0, enabled: false };

  try {
    const [urls, cache] = await Promise.all([
      getAllCardImageUrls(),
      caches.open(IMAGE_CACHE_NAME),
    ]);

    const checks = await Promise.all(urls.map(url => cache.match(url).then(r => !!r)));
    const cached = checks.filter(Boolean).length;

    return {
      cached,
      total: urls.length,
      enabled: cached > 0 && cached >= urls.length * 0.9,
    };
  } catch {
    return { cached: 0, total: 0, enabled: false };
  }
}

export async function clearOfflineImages(): Promise<void> {
  if (!isOfflineCacheSupported()) return;
  await caches.delete(IMAGE_CACHE_NAME);
  localStorage.removeItem(OFFLINE_KEY);
}
