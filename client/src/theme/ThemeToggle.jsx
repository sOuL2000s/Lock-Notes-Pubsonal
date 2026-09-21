// client/src/theme/ThemeToggle.jsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

function ThemeToggle({ style }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: 'var(--surface-2)',
        color: 'var(--accent)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.78rem',
        letterSpacing: '1px',
        transition: 'all var(--t-fast)',
        ...style,
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
      <span style={{ display: 'inline-block' }}>{isDark ? 'LIGHT' : 'DARK'}</span>
    </button>
  );
}

export default ThemeToggle;