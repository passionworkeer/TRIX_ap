import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import App from '@/App';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { VoiceSettingsProvider } from '@/contexts/VoiceSettingsContext';
import '@/i18n';
import { DesktopTitleBar } from './components/DesktopTitleBar';

// DesktopSettings page - imported lazily to avoid web build including it
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppRoutes } from '@/types';

const DesktopSettings = lazy(() => import('./pages/DesktopSettings'));

const SettingsLoading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
    加载中...
  </div>
);

// Desktop-specific router wrapper
function DesktopApp() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Desktop settings page */}
        <Route path="/desktop/settings" element={
          <Suspense fallback={<SettingsLoading />}>
            <DesktopSettings />
          </Suspense>
        } />
        {/* All other routes → existing App */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

// Mount
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No root element');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <VoiceSettingsProvider>
        <DesktopTitleBar>
          <DesktopApp />
        </DesktopTitleBar>
      </VoiceSettingsProvider>
    </ThemeProvider>
  </React.StrictMode>
);
