// client/src/components/TableOfContents.jsx
import React, { useMemo } from 'react';
import { List, X } from 'lucide-react';
import { extractHeadingList } from '../lib/markdown';

/**
 * Re-export a thin wrapper so callers can import { extractHeadings } from
 * this module if they want. It delegates to the single source of truth in
 * ../lib/markdown so IDs always match the rendered HTML.
 */
export function extractHeadings(markdown) {
  return extractHeadingList(markdown);
}

/**
 * TableOfContents
 *
 * @param {object} props
 *   @param {string} props.content        - raw markdown source
 *   @param {string} [props.activeId]     - id of the currently active heading
 *   @param {(id: string, lineIndex: number, level: number, text: string) => void} props.onSelect
 *   @param {() => void} [props.onClose]  - if provided, shows a close button
 *   @param {boolean} [props.compact]     - tighter spacing (for inline panels)
 */
function TableOfContents({ content, activeId, onSelect, onClose, compact = false }) {
  const headings = useMemo(() => extractHeadingList(content), [content]);

  if (!headings.length) {
    return (
      <div style={{ ...styles.empty, ...(compact ? styles.emptyCompact : {}) }}>
        <List size={16} style={{ opacity: 0.5, marginBottom: '6px' }} />
        <div style={styles.emptyText}>[ NO_HEADINGS_FOUND ]</div>
        <div style={styles.emptyHint}>
          Add <code style={styles.inlineCode}>#</code>,{' '}
          <code style={styles.inlineCode}>##</code>, or{' '}
          <code style={styles.inlineCode}>###</code> headings to build an outline.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, ...(compact ? styles.containerCompact : {}) }}>
      <div style={styles.header}>
        <span style={styles.title}>
          <List size={13} style={{ marginRight: '6px' }} />
          // OUTLINE
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close outline"
            title="Close outline"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <nav style={styles.nav} aria-label="Table of contents">
        {headings.map((h) => {
          const isActive = activeId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect && onSelect(h.id, undefined, h.level, h.text)}
              style={{
                ...styles.item,
                paddingLeft: `${12 + (h.level - 1) * 14}px`,
                ...(isActive ? styles.itemActive : {}),
                ...(h.level === 1 ? styles.itemH1 : {}),
                ...(h.level === 2 ? styles.itemH2 : {}),
                ...(h.level === 3 ? styles.itemH3 : {}),
              }}
              title={h.text}
            >
              <span style={styles.itemMarker}>
                {h.level === 1 ? '#' : h.level === 2 ? '##' : '###'}
              </span>
              <span style={styles.itemText}>{h.text}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    fontFamily: 'var(--font-mono)',
  },
  containerCompact: {
    padding: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    color: 'var(--accent)',
    fontSize: '0.72rem',
    fontWeight: '700',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  closeButton: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    maxHeight: '340px',
    overflowY: 'auto',
  },
  item: {
    background: 'none',
    border: 'none',
    borderLeft: '2px solid transparent',
    color: 'var(--text-dim)',
    textAlign: 'left',
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.74rem',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    transition: 'all var(--t-fast)',
    width: '100%',
  },
  itemActive: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    borderLeftColor: 'var(--accent)',
  },
  itemH1: { fontWeight: '700', color: 'var(--text)' },
  itemH2: { fontWeight: '600' },
  itemH3: { opacity: 0.85, fontSize: '0.7rem' },
  itemMarker: {
    color: 'var(--accent)',
    opacity: 0.5,
    fontSize: '0.62rem',
    flexShrink: 0,
    minWidth: '18px',
  },
  itemText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  empty: {
    padding: '16px 12px',
    textAlign: 'center',
    background: 'var(--surface-2)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-faint)',
    fontSize: '0.72rem',
    letterSpacing: '1px',
  },
  emptyCompact: { padding: '10px 8px' },
  emptyText: { marginBottom: '4px' },
  emptyHint: { opacity: 0.7, fontSize: '0.68rem', lineHeight: '1.5' },
  inlineCode: {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-line)',
    padding: '0 4px',
    borderRadius: '2px',
    color: 'var(--accent)',
  },
};

export default TableOfContents;