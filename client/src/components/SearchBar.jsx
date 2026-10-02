// client/src/components/SearchBar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Command, Loader2 } from 'lucide-react';

/**
 * Enhanced search bar with:
 * - Debounced input (configurable)
 * - Keyboard shortcut (Cmd/Ctrl + K) to focus
 * - Escape to clear
 * - Result count display
 * - Loading indicator that only appears after a short delay (avoids
 *   flicker when the network is fast)
 * - Clear button
 * - Remembers the last search term for the session
 */
function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'SEARCH_NOTES...',
  loading = false,
  resultCount = null,
  totalCount = null,
  debounceMs = 300,
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [showSpinner, setShowSpinner] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const spinnerTimerRef = useRef(null);

  // Restore the last search term on first mount (session-only, so it
  // doesn't persist across reloads).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('lock-notes:last-search');
      if (saved && !value) {
        setLocalValue(saved);
        onChange(saved);
      }
    } catch (e) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. clear from parent)
  useEffect(() => {
    if (value !== localValue) setLocalValue(value || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounce the change callback
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
        try {
          sessionStorage.setItem('lock-notes:last-search', localValue);
        } catch (e) {
          /* ignore */
        }
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, debounceMs]);

  // Delay showing the spinner by ~250ms so fast requests don't cause flicker
  useEffect(() => {
    if (spinnerTimerRef.current) {
      clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }
    if (loading) {
      spinnerTimerRef.current = setTimeout(() => setShowSpinner(true), 250);
    } else {
      setShowSpinner(false);
    }
    return () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    };
  }, [loading]);

  // Cmd/Ctrl + K to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalValue('');
      onChange('');
      onClear?.();
      try {
        sessionStorage.removeItem('lock-notes:last-search');
      } catch (err) {
        /* ignore */
      }
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    onClear?.();
    try {
      sessionStorage.removeItem('lock-notes:last-search');
    } catch (err) {
      /* ignore */
    }
    inputRef.current?.focus();
  };

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  const hasActiveQuery = localValue && localValue.trim().length > 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.inputRow}>
        <Search size={16} style={styles.searchIcon} />
        <input
          ref={inputRef}
          type="search"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={styles.input}
          aria-label="Search notes"
          autoComplete="off"
          spellCheck={false}
        />

        {showSpinner && (
          <Loader2
            size={16}
            style={{
              ...styles.spinner,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}

        {!showSpinner && hasActiveQuery && (
          <button
            type="button"
            onClick={handleClear}
            style={styles.clearButton}
            aria-label="Clear search"
            title="Clear search (Esc)"
          >
            <X size={14} />
          </button>
        )}

        {!localValue && (
          <kbd style={styles.kbd} title="Focus search">
            {isMac ? <Command size={10} /> : 'Ctrl'} K
          </kbd>
        )}
      </div>

      {(resultCount !== null || totalCount !== null) && hasActiveQuery && (
        <div style={styles.resultInfo}>
          {loading ? (
            <span>SEARCHING…</span>
          ) : resultCount !== null ? (
            <span>
              {resultCount} {resultCount === 1 ? 'RESULT' : 'RESULTS'}
              {totalCount !== null && resultCount !== totalCount
                ? ` OF ${totalCount}`
                : ''}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    flex: '1 1 280px',
    maxWidth: '520px',
    width: '100%',
  },
  inputRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--accent)',
    opacity: 0.5,
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '12px 80px 12px 40px',
    backgroundColor: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    outline: 'none',
    transition: 'all var(--t-fast)',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  spinner: {
    position: 'absolute',
    right: '44px',
    color: 'var(--accent)',
    opacity: 0.7,
  },
  clearButton: {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    opacity: 0.8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbd: {
    position: 'absolute',
    right: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '3px 6px',
    fontSize: '0.62rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-faint)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    pointerEvents: 'none',
    letterSpacing: '0.5px',
  },
  resultInfo: {
    marginTop: '6px',
    fontSize: '0.68rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-faint)',
    letterSpacing: '1px',
    textAlign: 'center',
  },
};

export default SearchBar;