// client/src/components/SearchBar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Command, Loader2, ChevronDown, Filter } from 'lucide-react';

/**
 * Compact, command-palette-style search bar.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ 🔍  [MATCH ALL ▾]  Search notes…      3 RESULTS   ⌘K   ✕    │
 *   └─────────────────────────────────────────────────────────────┘
 *   ────────────────────────────────────────────────────────────  (progress bar)
 *
 * - Debounced (default 200ms — snappy but not chatty).
 * - Mode is a compact dropdown *inside* the input, on the left.
 * - Result count appears as a subtle pill on the right.
 * - A thin animated bar under the input indicates an in-flight search.
 * - Cmd/Ctrl+K focuses; Escape clears immediately.
 * - Clear button appears only when there is text.
 */
function SearchBar({
  value,
  onChange,
  mode = 'all',
  onModeChange,
  placeholder = 'Search notes…',
  loading = false,
  resultCount = null,
  totalCount = null,
  debounceMs = 200,
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [showSpinner, setShowSpinner] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const spinnerTimerRef = useRef(null);
  const modeRef = useRef(null);

  // Sync external value.
  useEffect(() => {
    if (value !== localValue) setLocalValue(value || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced onChange.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localValue !== value) onChange(localValue);
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, debounceMs]);

  // Delayed spinner (only after 250ms so fast requests don't flash).
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

  // Cmd/Ctrl+K to focus.
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

  // Close mode dropdown on outside click.
  useEffect(() => {
    if (!modeOpen) return;
    const handler = (e) => {
      if (modeRef.current && !modeRef.current.contains(e.target)) {
        setModeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [modeOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalValue('');
      onChange('');
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  const hasActiveQuery = localValue && localValue.trim().length > 0;

  const modeLabels = {
    all: 'MATCH ALL',
    phrase: 'PHRASE',
    any: 'MATCH ANY',
  };
  const modeLabel = modeLabels[mode] || 'MATCH ALL';

  // Decide what to show in the right-hand meta area.
  const showResultPill =
    hasActiveQuery && !loading && resultCount !== null && resultCount !== undefined;

  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.inputRow,
          ...(loading ? styles.inputRowLoading : {}),
        }}
      >
        {/* Search icon */}
        <Search size={15} style={styles.searchIcon} />

        {/* Mode dropdown (inside the input, left side) */}
        <div ref={modeRef} style={styles.modeWrap}>
          <button
            type="button"
            onClick={() => setModeOpen((v) => !v)}
            style={styles.modeButton}
            aria-haspopup="listbox"
            aria-expanded={modeOpen}
            title="How multiple search words are combined"
          >
            <Filter size={10} style={{ marginRight: '4px', opacity: 0.75 }} />
            <span style={styles.modeButtonLabel}>{modeLabel}</span>
            <ChevronDown size={10} style={{ marginLeft: '3px', opacity: 0.6 }} />
          </button>

          {modeOpen && (
            <div style={styles.modeMenu} role="listbox">
              {[
                { key: 'all', label: 'MATCH ALL WORDS', hint: 'Every word must appear' },
                { key: 'phrase', label: 'EXACT PHRASE', hint: 'The whole phrase must appear' },
                { key: 'any', label: 'MATCH ANY WORD', hint: 'Any word may appear' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onModeChange?.(opt.key);
                    setModeOpen(false);
                    inputRef.current?.focus();
                  }}
                  style={{
                    ...styles.modeItem,
                    ...(mode === opt.key ? styles.modeItemActive : {}),
                  }}
                  role="option"
                  aria-selected={mode === opt.key}
                >
                  <span style={styles.modeItemLabel}>{opt.label}</span>
                  <span style={styles.modeItemHint}>{opt.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text input */}
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

        {/* Right-hand meta: result pill OR kbd hint OR clear button */}
        <div style={styles.rightMeta}>
          {showSpinner && (
            <Loader2
              size={13}
              style={{ ...styles.spinner, animation: 'spin 0.8s linear infinite' }}
            />
          )}

          {showResultPill && (
            <span style={styles.resultPill} title="Matches for this search">
              {resultCount}
              {totalCount !== null && totalCount !== resultCount
                ? ` / ${totalCount}`
                : ''}
            </span>
          )}

          {!hasActiveQuery && !showSpinner && (
            <kbd style={styles.kbd} title="Focus search">
              {isMac ? <Command size={9} /> : 'Ctrl'} K
            </kbd>
          )}

          {hasActiveQuery && !showSpinner && (
            <button
              type="button"
              onClick={handleClear}
              style={styles.clearButton}
              aria-label="Clear search"
              title="Clear search (Esc)"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Thin animated progress bar under the input while searching */}
      <div style={styles.progressTrack} aria-hidden="true">
        {loading && <div style={styles.progressBar} />}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    flex: '1 1 340px',
    maxWidth: '620px',
    width: '100%',
  },
  inputRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
    paddingLeft: '34px', // room for the search icon
  },
  inputRowLoading: {
    borderColor: 'var(--accent-line)',
    boxShadow: '0 0 0 1px var(--accent-line)',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--accent)',
    opacity: 0.55,
    pointerEvents: 'none',
    zIndex: 1,
  },
  modeWrap: {
    position: 'relative',
    flexShrink: 0,
    marginLeft: '2px',
    marginRight: '4px',
    zIndex: 2,
  },
  modeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 6px',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-line)',
    borderRadius: '3px',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all var(--t-fast)',
    whiteSpace: 'nowrap',
  },
  modeButtonLabel: {
    display: 'inline-block',
  },
  modeMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    minWidth: '230px',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-2)',
    padding: '4px',
    zIndex: 1000,
    animation: 'fadeIn var(--t-fast) both',
  },
  modeItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    width: '100%',
    padding: '8px 10px',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background var(--t-fast)',
  },
  modeItemActive: {
    background: 'var(--accent-soft)',
  },
  modeItemLabel: {
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  modeItemHint: {
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.62rem',
    letterSpacing: '0.5px',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '11px 6px 11px 4px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    fontSize: 'clamp(0.82rem, 1.5vw, 0.9rem)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  rightMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingRight: '10px',
    flexShrink: 0,
  },
  spinner: {
    color: 'var(--accent)',
    opacity: 0.8,
  },
  resultPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-line)',
    borderRadius: '10px',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.62rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  clearButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 5px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    color: 'var(--accent)',
    cursor: 'pointer',
    opacity: 0.8,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '2px 6px',
    fontSize: '0.6rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-faint)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  progressTrack: {
    position: 'relative',
    height: '2px',
    marginTop: '2px',
    overflow: 'hidden',
    borderRadius: '2px',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '40%',
    background:
      'linear-gradient(90deg, transparent, var(--accent), transparent)',
    animation: 'searchSweep 1.1s ease-in-out infinite',
  },
};

export default SearchBar;