// client/src/theme/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'lock-notes-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) { /* ignore */ }

  if (window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Apply to <html data-theme="..."> so CSS variables take effect
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) { /* ignore */ }
  }, [theme]);

  // Follow OS changes if user hasn't explicitly chosen
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      let stored = null;
      try { stored = window.localStorage.getItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      if (!stored) setThemeState(e.matches ? 'light' : 'dark');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const setTheme = useCallback((next) => {
    if (next === 'light' || next === 'dark') setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}