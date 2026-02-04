const CACHE_NAME = 'minkiards-v1';
const CARD_CACHE_NAME = 'minkiards-cards-v1';
const STATIC_CACHE_NAME = 'minkiards-static-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sounds/attack.mp3',
  '/sounds/card-draw.mp3',
  '/sounds/card-play.mp3',
  '/sounds/victory.mp3',
  '/sounds/defeat.mp3'
];

self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('undefined')));
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.log('[SW] Cache error:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== CARD_CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  if (url.hostname.includes('postimg.cc') || 
      url.hostname.includes('ibb.co') ||
      url.hostname.includes('imgur.com') ||
      url.pathname.includes('/cards/')) {
    event.respondWith(
      caches.open(CARD_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('Image not available offline', { status: 503 });
          });
        });
      })
    );
    return;
  }
  
  if (url.pathname.endsWith('.mp3') || 
      url.pathname.endsWith('.wav') ||
      url.pathname.includes('/sounds/') ||
      url.pathname.includes('/audio/')) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('Audio not available offline', { status: 503 });
          });
        });
      })
    );
    return;
  }
  
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ 
          error: 'offline', 
          message: 'Sei offline - usa la modalità offline per giocare!' 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Resource not available offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'MINKIARDS';
  const options = {
    body: data.body || 'Hai una nuova notifica',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'minkiards-notification',
    data: {
      url: data.url || '/',
      type: data.type
    },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'notification-click',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CACHE_CARDS') {
    const cardUrls = event.data.urls || [];
    console.log('[SW] Caching', cardUrls.length, 'card images');
    
    caches.open(CARD_CACHE_NAME).then(cache => {
      cardUrls.forEach(url => {
        fetch(url, { mode: 'cors' })
          .then(response => {
            if (response.ok) {
              cache.put(url, response);
            }
          })
          .catch(() => {});
      });
    });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.ports[0].postMessage({ 
      hasUpdate: false,
      version: CACHE_NAME 
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
