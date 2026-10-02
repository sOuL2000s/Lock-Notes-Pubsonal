// client/src/theme/ThemeToggle.jsx
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeContext';

function ThemeToggle({ style }) {
  const { preference, theme, toggleTheme, setPreference } = useTheme();

  // Icon + label reflect the current *preference*, not the resolved theme,
  // so the user knows what they've chosen.
  const config = {
    dark:   { Icon: Moon,    label: 'DARK',   title: 'Theme: Dark (click for Light)' },
    light:  { Icon: Sun,     label: 'LIGHT',  title: 'Theme: Light (click for System)' },
    system: {
      Icon: Monitor,
      label: 'SYSTEM',
      title: `Theme: System — currently ${theme} (click for Dark)`,
    },
  }[preference] || { Icon: Monitor, label: 'SYSTEM', title: 'Theme' };

  const { Icon, label, title } = config;

  // Long-press / right-click cycles backwards (nice-to-have)
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (preference === 'dark') setPreference('system');
    else if (preference === 'system') setPreference('light');
    else setPreference('dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      onContextMenu={handleContextMenu}
      aria-label={`Switch theme (currently ${preference})`}
      title={title}
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
      <Icon size={14} />
      <span style={{ display: 'inline-block' }}>{label}</span>
    </button>
  );
}

export default ThemeToggle;