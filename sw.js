// Offline cache. Bump CACHE on every deploy so browsers fetch fresh files.
const CACHE = 'emma-strik-v45';
const ASSETS = [
  './', './index.html', './manifest.json', './icon.svg', './css/style.css', './vendor/pdf.mjs', './vendor/pdf.worker.mjs',
  './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png',
  './js/app.js', './js/store.js', './js/counters.js', './js/calculators.js', './js/gallery.js', './js/stash.js', './js/backup.js', './js/idb.js', './js/caticons.js', './js/reader.js', './js/pdfthumb.js', './js/videos.js', './js/datepicker.js', './js/theme.js', './js/fireflies.js', './js/sync.js', './js/settings.js', './data/patterns.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Shell (navigation/index) = network-first so deploys aren't stranded; other assets = cache-first.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const path = new URL(req.url).pathname;
  const isShell = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('index.html');
  if (isShell) {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});

// hub-stats tracker v2
