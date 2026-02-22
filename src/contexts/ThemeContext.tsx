import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_MODE_KEY = 'themeMode';
const LEGACY_DARK_MODE_KEY = 'darkMode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readInitialThemeMode(): ThemeMode {
  const storedThemeMode = localStorage.getItem(THEME_MODE_KEY);
  if (
    storedThemeMode === 'system' ||
    storedThemeMode === 'light' ||
    storedThemeMode === 'dark'
  ) {
    return storedThemeMode;
  }

  // Backward compatibility for old boolean darkMode key.
  const legacyDarkMode = localStorage.getItem(LEGACY_DARK_MODE_KEY);
  if (legacyDarkMode === 'true') return 'dark';
  if (legacyDarkMode === 'false') return 'light';

  return 'system';
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => readInitialThemeMode());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemPrefersDark;
    }
    return themeMode === 'dark';
  }, [themeMode, systemPrefersDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(THEME_MODE_KEY, themeMode);
    localStorage.removeItem(LEGACY_DARK_MODE_KEY);
  }, [isDark, themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    if (themeMode === 'system') {
      setThemeModeState(isDark ? 'light' : 'dark');
      return;
    }
    setThemeModeState((previous) => (previous === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
