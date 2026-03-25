/**
 * Component tests for ErrorBoundary
 *
 * Tests that the error boundary catches errors and shows fallback UI
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock logger to prevent console errors in tests
vi.mock('../utils/logger', () => ({
  logger: {
    ui: {
      error: vi.fn(),
    },
  },
}));

// Mock isDev
vi.mock('../utils/env', () => ({
  isDev: vi.fn(() => false),
}));

// Mock window.location.reload
const locationMock = { hash: '' };
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationMock.hash = '';
  });

  it('should render children when no error occurs', async () => {
    const ErrorBoundary = (await import('./ErrorBoundary')).default;

    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('should show error fallback UI when child throws', async () => {
    const ErrorBoundary = (await import('./ErrorBoundary')).default;

    class ErrorThrower extends React.Component {
      override componentDidMount() {
        throw new Error('Test error');
      }
      override render() {
        return <div>Should not render</div>;
      }
    }

    render(
      <ErrorBoundary>
        <ErrorThrower />
      </ErrorBoundary>
    );

    // Should show error fallback UI
    expect(screen.getByText('出错了')).toBeInTheDocument();
    expect(screen.getByText(/抱歉，应用遇到了意外错误/)).toBeInTheDocument();
  });

  it('should have reload and go home buttons', async () => {
    const ErrorBoundary = (await import('./ErrorBoundary')).default;

    class ErrorThrower extends React.Component {
      override componentDidMount() {
        throw new Error('Test error');
      }
      override render() {
        return <div>Should not render</div>;
      }
    }

    render(
      <ErrorBoundary>
        <ErrorThrower />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument();
  });

  it('should call window.location.reload when reload button is clicked', async () => {
    const ErrorBoundary = (await import('./ErrorBoundary')).default;
    const reloadMock = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      value: reloadMock,
      writable: true,
    });

    class ErrorThrower extends React.Component {
      override componentDidMount() {
        throw new Error('Test error');
      }
      override render() {
        return <div>Should not render</div>;
      }
    }

    render(
      <ErrorBoundary>
        <ErrorThrower />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: '重新加载' });
    reloadButton.click();

    expect(reloadMock).toHaveBeenCalled();
  });

  it('should call window.location.hash when go home button is clicked', async () => {
    const ErrorBoundary = (await import('./ErrorBoundary')).default;

    class ErrorThrower extends React.Component {
      override componentDidMount() {
        throw new Error('Test error');
      }
      override render() {
        return <div>Should not render</div>;
      }
    }

    render(
      <ErrorBoundary>
        <ErrorThrower />
      </ErrorBoundary>
    );

    const goHomeButton = screen.getByRole('button', { name: '返回首页' });
    goHomeButton.click();

    expect(locationMock.hash).toBe('/');
  });
});
