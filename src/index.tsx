import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { VoiceSettingsProvider } from './contexts/VoiceSettingsContext';
import './i18n'; // Import i18n configuration
import { validateEnv } from './utils/env'; // Import env validation

// Validate environment variables before starting the app
validateEnv();

async function retireLegacyPwaShell() {
  const cleanupTasks: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    cleanupTasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.allSettled(registrations.map((registration) => registration.unregister()))
        )
    );
  }

  if ('caches' in window) {
    cleanupTasks.push(
      caches.keys().then((cacheNames) =>
        Promise.allSettled(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        )
      )
    );
  }

  await Promise.allSettled(cleanupTasks);
}

function scheduleLegacyPwaRetirement() {
  const cleanup = () => {
    void retireLegacyPwaShell();
  };

  const windowWithIdleCallback = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  if (typeof windowWithIdleCallback.requestIdleCallback === 'function') {
    windowWithIdleCallback.requestIdleCallback(cleanup, { timeout: 5000 });
    return;
  }

  window.setTimeout(cleanup, 0);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

function bootstrap() {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <VoiceSettingsProvider>
          <App />
        </VoiceSettingsProvider>
      </ThemeProvider>
    </React.StrictMode>
  );

  scheduleLegacyPwaRetirement();
}

bootstrap();
