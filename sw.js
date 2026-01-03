// Service Worker pour Terminus
const CACHE_NAME = 'terminus-v4.2.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/animations.css',
  './js/config.js',
  './js/categories.js',
  './js/history.js',
  './js/calendar.js',
  './js/share.js',
  './js/app.js',
  './js/geolocation.js',
  './js/alerts.js',
  './js/map.js',
  './js/storage.js',
  './js/transport.js',
  './js/search.js',
  './js/user-info.js',
  './assets/icons/logo.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Terminus: Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Terminus: Suppression ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie Network First avec fallback sur cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes vers des APIs externes
  if (event.request.url.includes('nominatim.openstreetmap.org') ||
      event.request.url.includes('tile.openstreetmap.org') ||
      event.request.url.includes('overpass-api.de') ||
      event.request.url.includes('ipapi.co') ||
      event.request.url.includes('ip-api.com') ||
      event.request.url.includes('photon.komoot.io') ||
      event.request.url.includes('api.open-meteo.com') ||
      event.request.url.includes('unpkg.com') ||
      event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la réponse est valide, la mettre en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // En cas d'erreur réseau, utiliser le cache
        return caches.match(event.request);
      })
  );
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Vous approchez de votre destination !',
    icon: './assets/icons/icon-192x192.png',
    badge: './assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'terminus-notification',
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification('🚂 Terminus', options)
  );
});

// Gestion des clics sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si une fenêtre est déjà ouverte, la focus
        for (const client of clientList) {
          if (client.url.includes('terminus') && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});

// Message du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
