const imageCache = new Map<string, HTMLImageElement>();

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
