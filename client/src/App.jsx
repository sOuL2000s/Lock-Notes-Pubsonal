// client/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteViewer from './components/NoteViewer';
import SharedNote from './components/SharedNote';
import ThemeToggle from './theme/ThemeToggle';
import { api } from './services/api';
import { Terminal, Plus, AlertTriangle, Search } from 'lucide-react';

const PAGE_SIZE = 20;

function HomePage() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [preVerifiedPassword, setPreVerifiedPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Debounce the search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadNotes = useCallback(
    async ({ append = false } = {}) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const data = await api.getNotes({
          q: debouncedQuery || undefined,
          sort,
          limit: PAGE_SIZE,
          cursor: append ? nextCursor || undefined : undefined,
        });
        const list = data.notes || [];
        setNotes((prev) => (append ? [...prev, ...list] : list));
        setNextCursor(data.nextCursor || null);
        setHasMore(!!data.hasMore);
        setTotal(typeof data.total === 'number' ? data.total : list.length);
        setError(null);
      } catch (err) {
        setError('FAILED_TO_LOAD_NOTES');
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, sort, nextCursor]
  );

  useEffect(() => {
    loadNotes({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sort]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    loadNotes({ append: true });
  };

  const handleCreateNote = async (noteData) => {
    try {
      const newNote = await api.createNote(noteData);
      setNotes((prev) => [newNote, ...prev]);
      setViewMode('list');
      setCurrentNote(null);
      setPreVerifiedPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'CREATE_FAILED');
      throw err;
    }
  };

  const handleUpdateNote = async (id, noteData) => {
    try {
      const updatedNote = await api.updateNote(id, noteData);
      setNotes((prev) => prev.map((n) => (n._id === id ? updatedNote : n)));
      setViewMode('list');
      setCurrentNote(null);
      setPreVerifiedPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'UPDATE_FAILED');
      throw err;
    }
  };

  const handleDeleteNote = async (id, password) => {
    try {
      await api.deleteNote(id, password);
      setNotes((prev) => prev.filter((n) => n._id !== id));
      if (currentNote?._id === id) {
        setCurrentNote(null);
        setViewMode('list');
        setPreVerifiedPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'DELETE_FAILED');
      throw err;
    }
  };

  const handleViewNote = async (id, preVerifiedPassword = '') => {
    try {
      const note = await api.getNote(id);
      setCurrentNote(note);
      setPreVerifiedPassword(preVerifiedPassword);
      setViewMode('view');
    } catch (err) {
      setError('LOAD_NOTE_FAILED');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const handleEditNote = (note, verifiedPassword = '') => {
    setCurrentNote(note);
    setPreVerifiedPassword(verifiedPassword);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setCurrentNote(null);
    setError(null);
    setPreVerifiedPassword('');
  };

  if (loading && viewMode === 'list') {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>INITIALIZING_SYSTEM...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Terminal size={28} color="var(--accent)" />
          <h1 style={styles.logo}>// NOTE_SHARE</h1>
          <p style={styles.tagline}>[ SECURE_NOTE_SYSTEM ]</p>
        </div>
        <div style={{ position: 'absolute', right: 0, top: 0 }}>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={18} style={styles.errorIcon} />
          <span style={styles.errorText}>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          <button
            onClick={() => {
              localStorage.removeItem('note_draft');
              setCurrentNote(null);
              setViewMode('create');
              setPreVerifiedPassword('');
            }}
            style={styles.createButton}
          >
            <Plus size={18} style={styles.createIcon} />
            CREATE_NOTE
          </button>

          <div style={styles.toolbar}>
            <div style={styles.searchWrapper}>
              <Search size={16} style={styles.searchIcon} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH_NOTES..."
                style={styles.searchInput}
                aria-label="Search notes"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={styles.searchClear}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={styles.sortSelect}
              aria-label="Sort notes"
            >
              <option value="recent">NEWEST</option>
              <option value="oldest">OLDEST</option>
              <option value="updated">RECENTLY UPDATED</option>
              <option value="title">TITLE A→Z</option>
              <option value="title_desc">TITLE Z→A</option>
            </select>
          </div>

          <div style={styles.counter}>
            {total > 0 && (
              <span>
                SHOWING {notes.length} OF {total}
                {debouncedQuery ? ` · SEARCH "${debouncedQuery}"` : ''}
              </span>
            )}
          </div>

          <NoteList
            notes={notes}
            totalCount={total}
            searchQuery={debouncedQuery}
            onViewNote={handleViewNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={styles.loadMoreButton}
              >
                {loadingMore ? 'LOADING…' : 'LOAD_MORE'}
              </button>
            </div>
          )}
        </>
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <NoteEditor
          note={viewMode === 'edit' ? currentNote : null}
          preVerifiedPassword={preVerifiedPassword}
          onSave={viewMode === 'edit' ? handleUpdateNote : handleCreateNote}
          onCancel={handleBackToList}
        />
      )}

      {viewMode === 'view' && currentNote && (
        <NoteViewer
          note={currentNote}
          preVerifiedPassword={preVerifiedPassword}
          onEdit={(n, pw) => handleEditNote(n, pw)}
          onDelete={handleDeleteNote}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}

function SharedNotePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getSharedNote(token);
        if (!cancelled) setNote(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'SHARED_NOTE_FAILED');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>LOADING_SHARED_NOTE...</p>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBanner}>
          <AlertTriangle size={18} style={styles.errorIcon} />
          <span style={styles.errorText}>⚠️ {error || 'NOT_FOUND'}</span>
        </div>
        <button style={styles.createButton} onClick={() => navigate('/')}>
          BACK_TO_HOME
        </button>
      </div>
    );
  }

  return <SharedNote note={note} onBack={() => navigate('/')} />;
}

function App() {
  // Scroll to top on navigation
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/s/:token" element={<SharedNotePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}

// ----- inline styles -----
const styles = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '20px',
    width: '100%',
    position: 'relative',
  },
  header: {
    marginBottom: '32px',
    textAlign: 'center',
    animation: 'fadeIn var(--t-slow) both',
    position: 'relative',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  logo: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: '800',
    color: 'var(--accent)',
    textShadow: '0 0 20px var(--accent-glow)',
    letterSpacing: '2px',
    fontFamily: 'var(--font-mono)',
  },
  tagline: {
    fontSize: 'clamp(0.7rem, 1.5vw, 0.9rem)',
    color: 'var(--accent)',
    opacity: 0.5,
    fontWeight: '400',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '4px',
  },
  createButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: 'clamp(12px, 2vw, 16px) clamp(20px, 3vw, 32px)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'all var(--t-fast)',
    boxShadow: 'var(--shadow-1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    maxWidth: '320px',
    marginLeft: 'auto',
    marginRight: 'auto',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
  },
  createIcon: { fontSize: '1.2rem' },
  toolbar: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '720px',
    margin: '0 auto 16px auto',
  },
  searchWrapper: {
    position: 'relative',
    flex: '1 1 320px',
    maxWidth: '480px',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--accent)',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    backgroundColor: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    outline: 'none',
    transition: 'all var(--t-fast)',
  },
  searchClear: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    opacity: 0.7,
  },
  sortSelect: {
    padding: '12px 36px 12px 14px',
    backgroundColor: 'var(--surface-3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    letterSpacing: '1px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      'linear-gradient(45deg, transparent 50%, var(--accent) 50%), linear-gradient(135deg, var(--accent) 50%, transparent 50%)',
    backgroundPosition:
      'calc(100% - 18px) 50%, calc(100% - 12px) 50%',
    backgroundSize: '6px 6px, 6px 6px',
    backgroundRepeat: 'no-repeat',
    colorScheme: 'dark',
  },
  counter: {
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    letterSpacing: '1px',
    color: 'var(--text-dim)',
    marginBottom: '16px',
    minHeight: '1em',
  },
  loadMoreButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '12px 32px',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    letterSpacing: '1px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all var(--t-fast)',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    border: '3px solid var(--accent-soft)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'var(--accent)',
    fontSize: '0.9rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '2px',
    opacity: 0.6,
  },
  errorBanner: {
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: 'clamp(12px, 2vw, 16px) clamp(16px, 2.5vw, 24px)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid var(--danger)',
    animation: 'fadeIn var(--t-fast) both',
    fontFamily: 'var(--font-mono)',
  },
  errorIcon: { flexShrink: 0 },
  errorText: { flex: 1, fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)' },
  errorClose: {
    background: 'none',
    border: '1px solid var(--danger)',
    color: 'var(--danger)',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
  },
};

export default App;