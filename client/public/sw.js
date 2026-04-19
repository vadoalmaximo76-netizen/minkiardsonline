const STATIC_CACHE_NAME = 'minkiards-static-v1';
const IMAGE_CACHE_NAME = 'minkiards-images-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Card image hosts to intercept and serve from cache
function isCardImageRequest(url) {
  return (
    url.includes('postimg.cc') ||
    url.includes('i.imgur.com') ||
    url.includes('res.cloudinary.com')
  );
}

self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).then(function() {
        console.log('[SW] Static assets pre-cached');
        return self.skipWaiting();
      }).catch(function(err) {
        console.warn('[SW] Failed to pre-cache some static assets:', err);
        return self.skipWaiting();
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Service worker activated');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            return name !== STATIC_CACHE_NAME && name !== IMAGE_CACHE_NAME;
          })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // Cache card images from remote CDNs
  if (isCardImageRequest(url)) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          if (cached) {
            return cached;
          }
          return fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() {
            return new Response('', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // Serve static assets from cache with network fallback
  if (event.request.method === 'GET' && !url.includes('/api/') && !url.includes('/socket.io/')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) {
          return cached;
        }
        return fetch(event.request).catch(function() {
          // If offline and no cache match, return cached index for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // API calls and WebSocket: always go to network, never intercept
});

// Handle messages from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    caches.delete(IMAGE_CACHE_NAME).then(function() {
      if (event.source) event.source.postMessage({ type: 'IMAGE_CACHE_CLEARED' });
    });
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push received');

  let data = { title: 'MINKIARDS', body: 'Hai una nuova notifica!', tag: 'minkiards', url: '/' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.svg',
    tag: data.tag || 'minkiards',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
