const CACHE_NAME = 'miraculous-uno-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './styles.css',
    './animations.css',
    './game.js',
    './ui.js',
    './ai.js',
    './js/audio.js',
    './manifest.json',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        // 1. Check Hot Update Cache first (Priority)
        caches.open('uno-hot-update').then((hotCache) => {
            return hotCache.match(event.request).then((hotResponse) => {
                if (hotResponse) return hotResponse;

                // 2. Fallback to Local Assets Cache
                return caches.match(event.request).then((localResponse) => {
                    return localResponse || fetch(event.request);
                });
            });
        })
    );
});
