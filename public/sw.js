const APP_SHELL_CACHE = 'trix-app-shell-v1';
const RUNTIME_CACHE = 'trix-runtime-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pairing.html',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const activeCaches = new Set([APP_SHELL_CACHE, RUNTIME_CACHE]);

      await Promise.all(
        cacheNames
          .filter((cacheName) => !activeCaches.has(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'TRIX_SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldHandleRuntimeRequest(request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return false;
  }

  if (request.mode === 'navigate') {
    return true;
  }

  return ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
}

async function handleNavigationRequest(request) {
  const url = new URL(request.url);
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok && isSameOrigin(url)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    if (url.pathname.endsWith('/pairing.html')) {
      const pairingShell = await caches.match('/pairing.html');
      if (pairingShell) {
        return pairingShell;
      }
    }

    const appShell = (await caches.match('/index.html')) || (await caches.match('/'));
    if (appShell) {
      return appShell;
    }

    throw error;
  }
}

async function handleRuntimeAsset(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkResponse = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkResponse;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!shouldHandleRuntimeRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleRuntimeAsset(request));
});
