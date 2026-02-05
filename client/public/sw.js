self.addEventListener('install', function(event) {
  console.log('[SW] Cleanup service worker installing...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Cleanup service worker activated, unregistering...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ type: 'SW_CACHE_CLEARED' });
      });
      return self.registration.unregister();
    }).then(function() {
      console.log('[SW] Service worker unregistered successfully');
      return self.clients.matchAll();
    }).then(function(clients) {
      clients.forEach(function(client) {
        client.navigate(client.url);
      });
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
