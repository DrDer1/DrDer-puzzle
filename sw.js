var CACHE_VERSION = 'v2';
var CACHE_NAME = 'drder-puzzle-' + CACHE_VERSION;
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function(event) {
  console.log('SW: Installing ' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('SW: Caching ' + ASSETS.length + ' files');
      return cache.addAll(ASSETS).catch(function(err) {
        console.warn('SW: Some files failed to cache', err);
      });
    }).then(function() {
      console.log('SW: Skip waiting');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  console.log('SW: Activating');
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name.startsWith('drder-puzzle-') && name !== CACHE_NAME;
        }).map(function(name) {
          console.log('SW: Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      console.log('SW: Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          }).catch(function() {});
        }
        return response;
      }).catch(function() {
        return new Response('غير متصل بالإنترنت', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
