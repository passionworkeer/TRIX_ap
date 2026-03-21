self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      await self.registration.unregister();

      await Promise.all(
        clientList.map(async (client) => {
          try {
            if ('navigate' in client) {
              await client.navigate(client.url);
              return;
            }
          } catch (_) {
            // Ignore reload failures and fall back to a client message.
          }

          client.postMessage({ type: 'trix-sw-retired' });
        })
      );
    })()
  );
});
