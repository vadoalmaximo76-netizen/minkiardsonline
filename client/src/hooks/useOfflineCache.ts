import { useEffect, useState, useCallback } from 'react';
import { CARD_DATA } from '../lib/cardData';

export interface CacheStatus {
  isOnline: boolean;
  cacheReady: boolean;
  cardsCached: number;
  totalCards: number;
  cacheProgress: number;
  isCaching: boolean;
}

export function useOfflineCache() {
  const [status, setStatus] = useState<CacheStatus>({
    isOnline: navigator.onLine,
    cacheReady: false,
    cardsCached: 0,
    totalCards: 0,
    cacheProgress: 0,
    isCaching: false,
  });

  useEffect(() => {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getAllCardUrls = useCallback((): string[] => {
    const urls: string[] = [];
    
    if (CARD_DATA.bonus) urls.push(...CARD_DATA.bonus);
    if (CARD_DATA.mosse) urls.push(...CARD_DATA.mosse);
    if (CARD_DATA.personaggi) urls.push(...CARD_DATA.personaggi);
    if (CARD_DATA.personaggi_speciali) urls.push(...CARD_DATA.personaggi_speciali);
    
    return urls.filter(url => url && typeof url === 'string');
  }, []);

  const cacheAllCards = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('[Cache] Service Worker not supported');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      console.log('[Cache] No active service worker');
      return false;
    }

    const cardUrls = getAllCardUrls();
    setStatus(prev => ({
      ...prev,
      isCaching: true,
      totalCards: cardUrls.length,
      cardsCached: 0,
      cacheProgress: 0,
    }));

    console.log(`[Cache] Caching ${cardUrls.length} card images...`);

    registration.active.postMessage({
      type: 'CACHE_CARDS',
      urls: cardUrls,
    });

    let cached = 0;
    const batchSize = 10;
    
    for (let i = 0; i < cardUrls.length; i += batchSize) {
      const batch = cardUrls.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
              cached++;
              setStatus(prev => ({
                ...prev,
                cardsCached: cached,
                cacheProgress: Math.round((cached / cardUrls.length) * 100),
              }));
            }
          } catch (e) {
          }
        })
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setStatus(prev => ({
      ...prev,
      isCaching: false,
      cacheReady: true,
      cacheProgress: 100,
    }));

    console.log(`[Cache] Cached ${cached}/${cardUrls.length} cards`);
    localStorage.setItem('minkiards_cache_ready', 'true');
    localStorage.setItem('minkiards_cache_date', new Date().toISOString());
    
    return true;
  }, [getAllCardUrls]);

  const checkCacheStatus = useCallback(async () => {
    const cacheReady = localStorage.getItem('minkiards_cache_ready') === 'true';
    const cardUrls = getAllCardUrls();
    
    setStatus(prev => ({
      ...prev,
      cacheReady,
      totalCards: cardUrls.length,
    }));

    return cacheReady;
  }, [getAllCardUrls]);

  const clearCache = useCallback(async () => {
    if ('caches' in window) {
      await caches.delete('minkiards-cards-v1');
      await caches.delete('minkiards-static-v1');
      await caches.delete('minkiards-v1');
    }
    localStorage.removeItem('minkiards_cache_ready');
    localStorage.removeItem('minkiards_cache_date');
    
    setStatus(prev => ({
      ...prev,
      cacheReady: false,
      cardsCached: 0,
      cacheProgress: 0,
    }));
  }, []);

  useEffect(() => {
    checkCacheStatus();
  }, [checkCacheStatus]);

  return {
    ...status,
    cacheAllCards,
    checkCacheStatus,
    clearCache,
    getAllCardUrls,
  };
}
