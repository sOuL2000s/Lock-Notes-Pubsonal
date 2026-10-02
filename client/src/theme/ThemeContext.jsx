// client/src/theme/ThemeContext.jsx
import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';

const ThemeContext = createContext({
  theme: 'dark',           // resolved theme actually applied: 'dark' | 'light'
  preference: 'system',    // user preference: 'dark' | 'light' | 'system'
  setTheme: () => {},
  setPreference: () => {},
  toggleTheme: () => {},
  isSystem: false,
});

const STORAGE_KEY = 'lock-notes-theme'; // stores 'dark' | 'light' | 'system'

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredPreference() {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch (e) { /* ignore */ }
  return 'system';
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(getStoredPreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Resolved theme: if preference is 'system', follow the OS
  const theme = preference === 'system' ? systemTheme : preference;

  // Persist preference + apply resolved theme to <html data-theme="...">
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) { /* ignore */ }
  }, [theme, preference]);

  // Listen for OS theme changes in real time
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => setSystemTheme(e.matches ? 'light' : 'dark');

    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const setPreference = useCallback((next) => {
    if (next === 'light' || next === 'dark' || next === 'system') {
      setPreferenceState(next);
    }
  }, []);

  // Legacy API: setTheme('light'|'dark') sets an explicit preference
  const setTheme = useCallback((next) => {
    if (next === 'light' || next === 'dark') setPreferenceState(next);
    else if (next === 'system') setPreferenceState('system');
  }, []);

  // Cycle: dark -> light -> system -> dark
  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'system';
      return 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setTheme,
      setPreference,
      toggleTheme,
      isSystem: preference === 'system',
    }),
    [theme, preference, setTheme, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}