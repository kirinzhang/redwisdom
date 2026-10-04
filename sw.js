const CACHE_NAME = 'redwisdom-shell-v13';
const SHELL_FILES = [
    './', './index.html', './reading.html', './chat.html', './practice.html', './problems.html', './me.html', './login.html',
    './timeline.html', './modern.html',
    './style.css?v=3', './assets/tailwind.css?v=1', './script.js?v=3', './config.js?v=7', './manifest.webmanifest',
    './assets/favicon.png', './assets/bg_back.jpg', './assets/bg_front.jpg', './assets/portrait_color.jpg',
    './js/i18n.js', './js/auth-utils.js', './js/cloud-sync.js', './js/auto-sync.js', './js/auto-sync-bootstrap.js',
    './js/problem-case-store.js', './js/practice-store.js', './js/conversation-store.js', './js/reading-notes-store.js',
    './js/reading-progress-store.js', './js/full-text-search.js', './js/text-anchors.js', './js/reading-guides.js',
    './js/history-case-retrieval.js',
    './js/timeline-data.js', './js/timeline.js',
    './js/modern-cases.js', './js/modern.js',
    './data/catalog.json', './data/text-edition.json', './data/history-cases.json', './data/history-problem-types.json'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(SHELL_FILES.map(file => cache.add(file)))));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request)
            .then(async response => {
                const copy = response.clone();
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, copy);
                return response;
            })
            .catch(() => caches.match(request).then(response => response || caches.match('./index.html'))));
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(fetch(request).then(async response => {
            if (response.ok || response.type === 'opaque') {
                const copy = response.clone();
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, copy);
            }
            return response;
        }).catch(() => caches.match(request)));
        return;
    }

    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
