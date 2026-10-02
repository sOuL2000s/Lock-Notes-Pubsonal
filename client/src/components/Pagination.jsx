// client/src/components/Pagination.jsx
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Page-number pagination.
 *
 * @param {object} props
 *   @param {number} props.currentPage     - 1-indexed current page
 *   @param {number} props.totalPages      - total number of pages
 *   @param {(page: number) => void} props.onPageChange
 *   @param {boolean} [props.loading]      - disable controls while loading
 *   @param {number} [props.siblingCount=1] - pages shown around current
 */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  siblingCount = 1,
}) {
  if (totalPages <= 1) return null;

  const range = (start, end) => {
    const out = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  };

  const getPageNumbers = () => {
    const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2 siblings, 2 ellipses
    if (totalPages <= totalNumbers) return range(1, totalPages);

    const leftSibling = Math.max(currentPage - siblingCount, 1);
    const rightSibling = Math.min(currentPage + siblingCount, totalPages);

    const showLeftEllipsis = leftSibling > 2;
    const showRightEllipsis = rightSibling < totalPages - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftCount = 3 + 2 * siblingCount;
      return [...range(1, leftCount), 'ellipsis-right', totalPages];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
      const rightCount = 3 + 2 * siblingCount;
      return [1, 'ellipsis-left', ...range(totalPages - rightCount + 1, totalPages)];
    }

    return [
      1,
      'ellipsis-left',
      ...range(leftSibling, rightSibling),
      'ellipsis-right',
      totalPages,
    ];
  };

  const pages = getPageNumbers();
  const canPrev = currentPage > 1 && !loading;
  const canNext = currentPage < totalPages && !loading;

  return (
    <nav style={styles.nav} aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
        style={{ ...styles.button, ...(!canPrev ? styles.buttonDisabled : {}) }}
        aria-label="First page"
        title="First page"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canPrev}
        style={{ ...styles.button, ...(!canPrev ? styles.buttonDisabled : {}) }}
        aria-label="Previous page"
        title="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, i) => {
        if (typeof p === 'string') {
          return (
            <span key={`${p}-${i}`} style={styles.ellipsis} aria-hidden="true">
              …
            </span>
          );
        }
        const isActive = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            disabled={loading}
            style={{
              ...styles.button,
              ...(isActive ? styles.buttonActive : {}),
              ...(loading ? styles.buttonDisabled : {}),
            }}
            aria-label={`Page ${p}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {p}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canNext}
        style={{ ...styles.button, ...(!canNext ? styles.buttonDisabled : {}) }}
        aria-label="Next page"
        title="Next page"
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext}
        style={{ ...styles.button, ...(!canNext ? styles.buttonDisabled : {}) }}
        aria-label="Last page"
        title="Last page"
      >
        <ChevronsRight size={16} />
      </button>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    flexWrap: 'wrap',
    marginTop: '28px',
    padding: '12px 8px',
    borderTop: '1px solid var(--border)',
  },
  button: {
    minWidth: '36px',
    height: '36px',
    padding: '0 10px',
    background: 'var(--surface-2)',
    color: 'var(--accent)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    fontWeight: '600',
    letterSpacing: '0.5px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--t-fast)',
  },
  buttonActive: {
    background: 'var(--accent)',
    color: 'var(--bg)',
    borderColor: 'var(--accent)',
    boxShadow: '0 0 12px var(--accent-glow)',
  },
  buttonDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  ellipsis: {
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    padding: '0 4px',
    userSelect: 'none',
  },
};

export default Pagination;