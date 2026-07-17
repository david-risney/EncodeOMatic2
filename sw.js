const CACHE_PREFIX = 'encodeomatic2-v';
const CACHE_NAME = 'encodeomatic2-v1.0.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './styles/controls.css',
  './styles/graph.css',
  './styles/data-viewer.css',
  './styles/dialogs.css',
  './styles/feedback.css',
  './assets/logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/screenshots/editor.png',
  './src/app.js',
  './src/version.js',
  './src/services/install.js',
  './src/guess.js',
  './src/session-name.js',
  './src/state.js',
  './src/ui/data-viewer.js',
  './src/ui/graph-editor.js',
  './src/ui/templates.js',
  './src/worker/worker-pool.js',
  './src/worker/pipe-worker.js',
  './src/pipes/pipe.js',
  './src/pipes/string-pipe.js',
  './src/pipes/graph.js',
  './src/pipes/registry.js',
  './src/pipes/builtin/input-pipe.js',
  './src/pipes/builtin/file-input-pipe.js',
  './src/pipes/builtin/encoding/base64.js',
  './src/pipes/builtin/encoding/binary.js',
  './src/pipes/builtin/encoding/charset.js',
  './vendor/iconv-lite.js',
  './src/pipes/builtin/encoding/hex.js',
  './src/pipes/builtin/encoding/html-encode.js',
  './src/pipes/builtin/encoding/percent.js',
  './src/pipes/builtin/encoding/slash-escape.js',
  './src/pipes/builtin/encoding/url-encode.js',
  './src/pipes/builtin/encoding/rot.js',
  './src/pipes/builtin/encoding/xml-encode.js',
  './src/pipes/builtin/parsing/json-parser.js',
  './src/pipes/builtin/parsing/regex-match.js',
  './src/pipes/builtin/parsing/url-parser.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error('Failed to precache the application shell:', error);
        throw error;
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Returning without respondWith leaves these requests to the browser's normal network handling.
  if (
    event.request.method !== 'GET'
    || url.origin !== self.location.origin
    // Version checks need to reach the deployed file instead of the precache.
    || url.searchParams.get('cache') === 'off'
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    // URL state lives in the query string, but every state uses the same cached app shell.
    const cacheKey = new Request(url.origin + url.pathname, event.request);
    event.respondWith(caches.match(cacheKey).then((cached) => cached || fetch(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
