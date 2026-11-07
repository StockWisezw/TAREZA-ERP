const CACHE_NAME = 'tareza-erp-pwa-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache notice:', err);
      });
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
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Bypass API proxy and remote Firebase/Firestore services
  if (
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages / routes like /pos, /inventory, /dashboard)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // Race network with 1500ms timeout
      new Promise((resolve) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          caches.match('/index.html').then((cached) => {
            if (cached) resolve(cached);
          });
        }, 1500);

        fetch(event.request)
          .then((response) => {
            clearTimeout(timer);
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
            }
            if (!timedOut) resolve(response);
          })
          .catch(() => {
            clearTimeout(timer);
            caches.match('/index.html').then((cached) => {
              resolve(cached || caches.match('/'));
            });
          });
      })
    );
    return;
  }

  // 2. Static Assets (Scripts, Styles, Fonts, Images)
  // Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse && 
            networkResponse.status === 200 && 
            (event.request.url.startsWith(self.location.origin) || url.hostname.includes('fonts.g'))
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and not in cache, fallback if image or font
          return null;
        });

      return cachedResponse || fetchPromise.then((resp) => {
        if (resp) return resp;
        // If script or style missing in offline cache, return empty script/style instead of crashing with 503 text
        if (url.pathname.endsWith('.js') || url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts')) {
          return new Response('/* Offline fallback */', { headers: { 'Content-Type': 'application/javascript' } });
        }
        if (url.pathname.endsWith('.css')) {
          return new Response('/* Offline fallback */', { headers: { 'Content-Type': 'text/css' } });
        }
        return new Response('', { status: 404, statusText: 'Not found offline' });
      });
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-transactions' || event.tag === 'tareza-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_TRIGGERED' });
        });
      })
    );
  }
});
