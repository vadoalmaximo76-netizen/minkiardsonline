const imageCache = new Map<string, HTMLImageElement>();

let cloudinaryCloudName: string | null = null;

async function fetchCloudinaryConfig() {
  try {
    const res = await fetch('/api/integrations-status');
    const data = await res.json();
    if (data.cloudinary) {
      const configRes = await fetch('/api/optimize-image?url=test&size=card');
      const configData = await configRes.json();
      if (configData.optimized && configData.optimized !== 'test') {
        const match = configData.optimized.match(/res\.cloudinary\.com\/([^/]+)/);
        if (match) cloudinaryCloudName = match[1];
      }
    }
  } catch {
  }
}

fetchCloudinaryConfig();

export function getOptimizedUrl(originalUrl: string, size: 'thumb' | 'card' | 'preview' | 'full' = 'card'): string {
  if (!cloudinaryCloudName || !originalUrl || originalUrl.startsWith('data:')) return originalUrl;
  
  const sizeMap: Record<string, string> = {
    thumb: 'w_80,h_120,c_fill,q_auto,f_auto',
    card: 'w_160,h_240,c_fill,q_auto,f_auto',
    preview: 'w_400,h_600,c_fill,q_auto,f_auto',
    full: 'q_auto,f_auto',
  };
  
  const transforms = sizeMap[size] || sizeMap.card;
  return `https://res.cloudinary.com/${cloudinaryCloudName}/image/fetch/${transforms}/${encodeURIComponent(originalUrl)}`;
}

export const preloadImage = (src: string): Promise<HTMLImageElement> => {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
};

export const preloadImages = async (urls: string[]): Promise<void> => {
  const promises = urls.map(url => 
    preloadImage(url).catch(err => {
      console.warn(`Failed to preload image: ${url}`, err);
      return null;
    })
  );
  await Promise.all(promises);
};

export const preloadCriticalImages = async (): Promise<void> => {
  const criticalImages = [
    'https://i.postimg.cc/nrC5w6jP/retro-personaggi.png',
    'https://i.postimg.cc/QtmRY4LB/retro-mosse.png',
    'https://i.postimg.cc/XqLs5bG4/retro-bonus.png',
    'https://i.postimg.cc/xjLKMKXQ/retro-personaggi-speciali.png',
  ];
  
  console.log('Preloading critical game images...');
  await preloadImages(criticalImages);
  console.log('Critical images preloaded');
};

export const isImageCached = (src: string): boolean => {
  return imageCache.has(src);
};

export const getCacheSize = (): number => {
  return imageCache.size;
};
