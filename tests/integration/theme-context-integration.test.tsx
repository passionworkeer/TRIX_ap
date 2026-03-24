/**
 * Integration tests for ThemeContext.
 *
 * Verifies ThemeContext state changes and persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const localStorageStore: Record<string, string> = {};
const matchMediaStore: Record<string, boolean> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
});

vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)' ? (matchMediaStore[query] ?? false) : false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext';

function ThemeConsumer() {
  const { isDark, themeMode, setThemeMode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="theme-mode">{themeMode}</span>
      <div data-testid="root-classes">{isDark ? 'dark-mode' : 'light-mode'}</div>
      <button data-testid="set-light" onClick={() => setThemeMode('light')}>Light</button>
      <button data-testid="set-dark" onClick={() => setThemeMode('dark')}>Dark</button>
      <button data-testid="set-system" onClick={() => setThemeMode('system')}>System</button>
      <button data-testid="toggle" onClick={() => toggleTheme()}>Toggle</button>
    </div>
  );
}

describe('ThemeContext integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    Object.keys(matchMediaStore).forEach(k => delete matchMediaStore[k]);
  });

  it('applies light mode when set to light', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.click(document.querySelector('[data-testid="set-light"]')!);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="theme-mode"]')?.textContent).toBe('light');
      expect(document.querySelector('[data-testid="is-dark"]')?.textContent).toBe('false');
    });
  });

  it('applies dark mode when set to dark', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.click(document.querySelector('[data-testid="set-dark"]')!);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="theme-mode"]')?.textContent).toBe('dark');
      expect(document.querySelector('[data-testid="is-dark"]')?.textContent).toBe('true');
    });
  });

  it('persists theme to localStorage when changed', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.click(document.querySelector('[data-testid="set-light"]')!);
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'light');
    });
  });

  it('toggle switches from dark to light', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    // Start with dark
    fireEvent.click(document.querySelector('[data-testid="set-dark"]')!);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="is-dark"]')?.textContent).toBe('true');
    });
    // Toggle
    fireEvent.click(document.querySelector('[data-testid="toggle"]')!);
    await waitFor(() => {
      expect(document.querySelector('[data-testid="theme-mode"]')?.textContent).toBe('light');
    });
  });

  it('reads themeMode from localStorage on mount', async () => {
    localStorageStore['themeMode'] = 'dark';
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-testid="theme-mode"]')?.textContent).toBe('dark');
      expect(document.querySelector('[data-testid="is-dark"]')?.textContent).toBe('true');
    });
  });
});
