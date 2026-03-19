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

// Global error handlers to diagnose white screen - MUST be first
window.onerror = (msg, src, line, col, err) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a1a2e;padding:20px;color:#ff6b6b;font-family:monospace;font-size:14px;overflow:auto;';
  errorDiv.innerHTML = `<h2 style="color:#ff6b6b;margin:0 0 16px">RENDERER ERROR</h2>
<div style="color:#f39c12;margin-bottom:8px">${msg}</div>
<div style="color:#888;font-size:12px;margin-bottom:16px">at ${src}:${line}:${col}</div>
<div style="color:#e74c3c;font-family:Consolas,monospace;white-space:pre-wrap;background:#0d1117;padding:12px;border-radius:4px">${err?.stack || 'No stack'}</div>`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
  console.error('[RENDERER ERROR]', msg, 'at', src, 'line', line, 'col', col, err);
  return true;
};
window.onunhandledrejection = (e) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1a1a2e;padding:20px;color:#ff6b6b;font-family:monospace;font-size:14px;overflow:auto;';
  errorDiv.innerHTML = `<h2 style="color:#f39c12;margin:0 0 16px">UNHANDLED PROMISE REJECTION</h2>
<div style="color:#e74c3c;font-family:Consolas,monospace;white-space:pre-wrap;background:#0d1117;padding:12px;border-radius:4px">${e.reason?.stack || String(e.reason)}</div>`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
  console.error('[RENDERER UNHANDLED]', e.reason);
};

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
