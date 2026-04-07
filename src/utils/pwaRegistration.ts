const SERVICE_WORKER_URL = '/sw.js';

export async function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    return;
  }

  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: '/',
    });

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'TRIX_SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) {
        return;
      }

      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'TRIX_SKIP_WAITING' });
        }
      });
    });
  } catch (error) {
    console.warn('[TRIX] Failed to register service worker', error);
  }
}

export function scheduleServiceWorkerRegistration() {
  const register = () => {
    void registerServiceWorker();
  };

  if (document.readyState === 'complete') {
    register();
    return;
  }

  window.addEventListener('load', register, { once: true });
}
