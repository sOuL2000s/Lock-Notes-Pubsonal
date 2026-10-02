// client/src/components/FloatingNoteActions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUp, ArrowDown, Edit, Trash2, History, Share2,
  Download, Copy, Check, X, List, MoreVertical,
} from 'lucide-react';

/**
 * Floating action bar for the note viewer.
 *
 * - Fixed to the bottom-right (desktop) / bottom (mobile).
 * - Collapses into a single FAB on small screens.
 * - Includes scroll-to-top and scroll-to-bottom buttons.
 * - Mirrors the top action bar so the user never has to scroll up.
 */
function FloatingNoteActions({
  onEdit,
  onDelete,
  onToggleVersions,
  onToggleShare,
  onToggleExport,
  onToggleToc,
  onCopyContent,
  contentCopied,
  showToc,
  showVersions,
  showShare,
  showExport,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(true);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 640 : false
  );

  // Track viewport size
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Track scroll position to decide which scroll buttons to show
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      setShowScrollTop(scrolled > 200);
      setShowScrollBottom(maxScroll - scrolled > 200);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  // Close the mobile menu on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest('[data-floating-actions]')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const actions = [
    {
      key: 'edit',
      label: 'EDIT',
      Icon: Edit,
      onClick: onEdit,
      primary: true,
    },
    {
      key: 'toc',
      label: 'OUTLINE',
      Icon: List,
      onClick: onToggleToc,
      active: showToc,
    },
    {
      key: 'versions',
      label: 'HISTORY',
      Icon: History,
      onClick: onToggleVersions,
      active: showVersions,
    },
    {
      key: 'share',
      label: 'SHARE',
      Icon: Share2,
      onClick: onToggleShare,
      active: showShare,
    },
    {
      key: 'export',
      label: 'EXPORT',
      Icon: Download,
      onClick: onToggleExport,
      active: showExport,
    },
    {
      key: 'copy',
      label: contentCopied ? 'COPIED' : 'COPY',
      Icon: contentCopied ? Check : Copy,
      onClick: onCopyContent,
      active: contentCopied,
    },
    {
      key: 'delete',
      label: 'DELETE',
      Icon: Trash2,
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <>
      {/* Scroll navigation buttons — always visible, bottom-left */}
      <div style={styles.scrollStack} aria-label="Scroll navigation">
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            style={styles.scrollButton}
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <ArrowUp size={18} />
          </button>
        )}
        {showScrollBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            style={styles.scrollButton}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={18} />
          </button>
        )}
      </div>

      {/* Action bar — bottom-right */}
      <div style={styles.actionStack} data-floating-actions>
        {isMobile ? (
          <>
            {/* Mobile: single FAB that expands into a vertical menu */}
            {open && (
              <div style={styles.mobileMenu}>
                {actions.map(({ key, label, Icon, onClick, active, danger }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onClick?.();
                      setOpen(false);
                    }}
                    style={{
                      ...styles.mobileMenuItem,
                      ...(active ? styles.mobileMenuItemActive : {}),
                      ...(danger ? styles.mobileMenuItemDanger : {}),
                    }}
                    aria-label={label}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{
                ...styles.fab,
                ...(open ? styles.fabOpen : {}),
              }}
              aria-label={open ? 'Close actions' : 'Open actions'}
              aria-expanded={open}
            >
              {open ? <X size={22} /> : <MoreVertical size={22} />}
            </button>
          </>
        ) : (
          /* Desktop: horizontal pill bar */
          <div style={styles.desktopBar}>
            {actions.map(({ key, label, Icon, onClick, active, danger, primary }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                style={{
                  ...styles.desktopButton,
                  ...(active ? styles.desktopButtonActive : {}),
                  ...(danger ? styles.desktopButtonDanger : {}),
                  ...(primary ? styles.desktopButtonPrimary : {}),
                }}
                title={label}
                aria-label={label}
                disabled={loading && (key === 'delete' || key === 'edit')}
              >
                <Icon size={14} />
                <span style={styles.desktopButtonLabel}>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  scrollStack: {
    position: 'fixed',
    left: '16px',
    bottom: '16px',
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    '@media (max-width: 640px)': {
      left: '8px',
      bottom: '80px',
    },
  },
  scrollButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border-strong)',
    color: 'var(--accent)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-2)',
    transition: 'all var(--t-fast)',
    backdropFilter: 'blur(8px)',
  },
  actionStack: {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: 950,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
    '@media (max-width: 640px)': {
      right: '12px',
      bottom: '16px',
    },
  },
  desktopBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-2)',
    backdropFilter: 'blur(12px)',
    flexWrap: 'wrap',
    maxWidth: 'calc(100vw - 32px)',
  },
  desktopButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    letterSpacing: '1px',
    fontWeight: '600',
    transition: 'all var(--t-fast)',
    whiteSpace: 'nowrap',
  },
  desktopButtonLabel: {
    display: 'inline',
    '@media (max-width: 900px)': {
      display: 'none',
    },
  },
  desktopButtonActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
  },
  desktopButtonPrimary: {
    background: 'var(--accent)',
    color: 'var(--bg)',
    borderColor: 'var(--accent)',
  },
  desktopButtonDanger: {
    color: 'var(--danger)',
  },
  fab: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px var(--accent-glow)',
    transition: 'all var(--t-fast)',
  },
  fabOpen: {
    background: 'var(--bg-elev)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
  },
  mobileMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    background: 'var(--bg-elev)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-2)',
    backdropFilter: 'blur(12px)',
    marginBottom: '4px',
    animation: 'slideUp var(--t-fast) both',
  },
  mobileMenuItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    letterSpacing: '1px',
    fontWeight: '600',
    transition: 'all var(--t-fast)',
    minWidth: '140px',
    justifyContent: 'flex-start',
  },
  mobileMenuItemActive: {
    background: 'var(--accent-soft)',
    borderColor: 'var(--accent)',
  },
  mobileMenuItemDanger: {
    color: 'var(--danger)',
  },
};

export default FloatingNoteActions;