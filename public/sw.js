const CACHE_NAME = 'pos-offline-cache-v2';
const OFFLINE_URLS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old service worker cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin or POST/PUT/DELETE requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // API or FireStore requests should go directly to network
  if (event.request.url.includes('/api/') || event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Use a Network-First strategy for application assets and routing.
  // This ensures the live application pulls the absolute latest bundle when online requested,
  // falling back to local service worker cache only when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, clone and update the cache for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation request fails and not cached, return root index page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          // Avoid TypeError: Failed to convert value to 'Response' by returning a transparent offline Response
          return new Response('Offline asset unavailable', { 
            status: 503, 
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  console.log('Background sync: syncing offline transactions...');
  // Logic to process an IndexedDB queue of offline sales
  // and push them to Firestore once connectivity is restored.
}
