const CACHE_NAME = 'drder-puzzle-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/192.png',
  './icons/512.png'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: تثبيت...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: تخزين الملفات');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('⏭️ Service Worker: skipWaiting');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: تفعيل...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('🗑️ Service Worker: حذف كاش قديم:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('📢 Service Worker: claim');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            return new Response('أنت غير متصل بالإنترنت. يرجى التحقق من اتصالك.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});
