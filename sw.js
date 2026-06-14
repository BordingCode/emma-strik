// Offline cache. Bump CACHE on every deploy so browsers fetch fresh files.
const CACHE = 'emma-strik-v11';
const ASSETS = [
  './', './index.html', './manifest.json', './icon.svg', './css/style.css',
  './js/app.js', './js/store.js', './js/counters.js', './js/calculators.js', './js/gallery.js', './js/stash.js', './js/backup.js', './js/idb.js', './js/caticons.js', './js/reader.js', './data/patterns.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => { e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))); });
