import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import '@/i18n';
import { LuminaLayout } from './stitch/shared/LuminaLayout';

// Global error handlers — show errors inline in the app
window.onerror = (msg, src, line, col, err) => {
  console.error('[RENDERER ERROR]', msg, 'at', src, 'line', line, 'col', col, err);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;padding:40px;color:#ff6b6b;font-family:ui-monospace,monospace;font-size:14px;overflow:auto;';
  errorDiv.innerHTML = `<div style="max-width:700px;margin:0 auto">
    <h2 style="color:#ff6b6b;margin:0 0 20px;font-size:20px">⚠️ 渲染器错误</h2>
    <div style="background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="color:#f59e0b;font-size:15px;margin-bottom:8px">${String(msg)}</div>
      <div style="color:#64748b;font-size:12px;margin-bottom:8px">at ${src}:${line}:${col}</div>
    </div>
    <pre style="background:#0d1117;border-radius:8px;padding:16px;color:#94a3b8;font-size:12px;overflow:auto">${err?.stack || 'No stack'}</pre>
  </div>`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
  return true;
};
window.onunhandledrejection = (e) => {
  console.error('[RENDERER UNHANDLED]', e.reason);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;padding:40px;color:#ff6b6b;font-family:ui-monospace,monospace;font-size:14px;overflow:auto;';
  errorDiv.innerHTML = `<div style="max-width:700px;margin:0 auto">
    <h2 style="color:#f59e0b;margin:0 0 20px;font-size:20px">⚠️ 未处理的异步错误</h2>
    <pre style="background:#0d1117;border-radius:8px;padding:16px;color:#94a3b8;font-size:12px;overflow:auto">${e.reason?.stack || String(e.reason)}</pre>
  </div>`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
};

class RenderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string; stack: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '', stack: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message, stack: error.stack || '' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#0f172a',
            padding: '40px',
            color: '#ff6b6b',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '14px',
            overflow: 'auto',
          }}
        >
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ color: '#ff6b6b', margin: '0 0 20px', fontSize: '20px' }}>
              ⚠️ React 渲染错误
            </h2>
            <div
              style={{
                background: '#1e293b',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ color: '#f59e0b', fontSize: '15px', marginBottom: '8px' }}>
                {this.state.error}
              </div>
            </div>
            <pre
              style={{
                background: '#0d1117',
                borderRadius: '8px',
                padding: '16px',
                color: '#94a3b8',
                fontSize: '12px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No root element');

const root = ReactDOM.createRoot(rootElement);
console.log('[Desktop] creating React root, rendering LuminaLayout');
root.render(
  <React.StrictMode>
    <RenderErrorBoundary>
      <LuminaLayout />
    </RenderErrorBoundary>
  </React.StrictMode>
);
console.log('[Desktop] LuminaLayout render called');
