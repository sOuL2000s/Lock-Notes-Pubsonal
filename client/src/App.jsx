// client/src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteViewer from './components/NoteViewer';
import SharedNote from './components/SharedNote';
import SearchBar from './components/SearchBar';
import Pagination from './components/Pagination';
import ThemeToggle from './theme/ThemeToggle';
import { api } from './services/api';
import { Terminal, Plus, AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 20;

// Small in-memory cache for recent (q, sort, page) results. Keeps
// toggling between two searches instant without hitting the API again.
const RESULT_CACHE_TTL_MS = 30 * 1000;

function HomePage() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preVerifiedPassword, setPreVerifiedPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('any');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // Cursor cache so we can jump between pages without re-walking.
  const cursorCache = useRef({ 1: undefined });

  // In-memory response cache: key = `${q}|${mode}|${sort}|${page}`.
  const resultCache = useRef(new Map());

  // Track if this is the first render (to avoid resetting page on mount).
  const isFirstRender = useRef(true);

  // Track whether we've completed at least one successful load. The
  // full-page spinner is only shown before this flips to true.
  const hasLoadedOnce = useRef(false);

  // Reset pagination whenever the search query or mode changes.
  // (SearchBar handles the debouncing of the raw input.)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
    cursorCache.current = { 1: undefined };
  }, [searchQuery, searchMode]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  const loadNotes = useCallback(
    async (targetPage = 1) => {
      const cacheKey = `${searchQuery}|${searchMode}|${sort}|${targetPage}`;
      const cached = resultCache.current.get(cacheKey);

      // Serve from cache when fresh (only for exact same query/mode/sort/page).
      if (cached && Date.now() - cached.time < RESULT_CACHE_TTL_MS) {
        setNotes(cached.notes);
        setTotal(cached.total);
        setError(null);
        setLoading(false);
        setSearchLoading(false);
        hasLoadedOnce.current = true;
        return;
      }

      try {
        setLoading(true);
        setSearchLoading(!!searchQuery);

        let cursor = cursorCache.current[targetPage];

        // If we don't have the cursor cached, walk forward to it.
        if (cursor === undefined && targetPage > 1) {
          const cachedPages = Object.keys(cursorCache.current)
            .map(Number)
            .filter(
              (p) => p < targetPage && cursorCache.current[p] !== undefined
            )
            .sort((a, b) => b - a);

          let startPage = cachedPages[0] || 1;
          let startCursor = cursorCache.current[startPage];

          for (let p = startPage + 1; p <= targetPage; p++) {
            const data = await api.getNotes({
              q: searchQuery || undefined,
              mode: searchQuery ? searchMode : undefined,
              sort,
              limit: PAGE_SIZE,
              cursor: startCursor,
            });
            cursorCache.current[p] = data.nextCursor || null;
            startCursor = data.nextCursor;
            if (!data.hasMore) break;
          }
          cursor = cursorCache.current[targetPage];
        }

        const data = await api.getNotes({
          q: searchQuery || undefined,
          mode: searchQuery ? searchMode : undefined,
          sort,
          limit: PAGE_SIZE,
          cursor: cursor || undefined,
        });

        const list = data.notes || [];
        const totalCount =
          typeof data.total === 'number' ? data.total : list.length;

        setNotes(list);
        setTotal(totalCount);
        cursorCache.current[targetPage + 1] = data.nextCursor || null;
        setError(null);
        hasLoadedOnce.current = true;

        // Remember this page for a short while.
        resultCache.current.set(cacheKey, {
          notes: list,
          total: totalCount,
          time: Date.now(),
        });
      } catch (err) {
        setError('FAILED_TO_LOAD_NOTES');
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        setLoading(false);
        setSearchLoading(false);
      }
    },
    [searchQuery, searchMode, sort]
  );

  useEffect(() => {
    loadNotes(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchMode, sort, page]);

  const handlePageChange = (nextPage) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNote = async (noteData) => {
    try {
      await api.createNote(noteData);
      cursorCache.current = { 1: undefined };
      resultCache.current.clear();
      setPage(1);
      await loadNotes(1);
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
      // The cached list is now stale.
      resultCache.current.clear();
    } catch (err) {
      setError(err.response?.data?.error || 'UPDATE_FAILED');
      throw err;
    }
  };

  const handleDeleteNote = async (id, password) => {
    try {
      await api.deleteNote(id, password);
      cursorCache.current = { 1: undefined };
      resultCache.current.clear();
      await loadNotes(page);
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

  // Only show the full-page spinner on the very first load.
  // Once we've loaded once, keep the list UI mounted even if a search
  // returns 0 results — otherwise the SearchBar unmounts and the input
  // loses focus mid-typing.
  const isInitialLoad = loading && viewMode === 'list' && notes.length === 0 && !hasLoadedOnce.current;
  if (isInitialLoad) {
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
        <div style={styles.themeToggleWrap}>
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={18} style={styles.errorIcon} />
          <span style={styles.errorText}>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>
            ✕
          </button>
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
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              mode={searchMode}
              onModeChange={(m) => {
                setSearchMode(m);
                setPage(1);
                cursorCache.current = { 1: undefined };
                resultCache.current.clear();
              }}
              loading={searchLoading}
              resultCount={searchQuery ? total : null}
              totalCount={searchQuery ? total : null}
              placeholder="Search notes…"
            />

            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
                cursorCache.current = { 1: undefined };
                resultCache.current.clear();
              }}
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
                PAGE {page} OF {totalPages} · SHOWING {notes.length} OF {total}
                {searchQuery ? ` · SEARCH "${searchQuery}"` : ''}
              </span>
            )}
          </div>

          <NoteList
            notes={notes}
            totalCount={total}
            searchQuery={searchQuery}
            onViewNote={handleViewNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            loading={loading}
          />
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
        if (!cancelled)
          setError(
            err.response?.data?.error || err.message || 'SHARED_NOTE_FAILED'
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    padding: 'clamp(12px, 3vw, 20px)',
    width: '100%',
    position: 'relative',
  },
  header: {
    marginBottom: 'clamp(20px, 4vw, 32px)',
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
  themeToggleWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  logo: {
    fontSize: 'clamp(1.6rem, 5vw, 3rem)',
    fontWeight: '800',
    color: 'var(--accent)',
    textShadow: '0 0 20px var(--accent-glow)',
    letterSpacing: '2px',
    fontFamily: 'var(--font-mono)',
  },
  tagline: {
    fontSize: 'clamp(0.65rem, 1.5vw, 0.9rem)',
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
    maxWidth: '900px',
    margin: '0 auto 16px auto',
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
    backgroundPosition: 'calc(100% - 18px) 50%, calc(100% - 12px) 50%',
    backgroundSize: '6px 6px, 6px 6px',
    backgroundRepeat: 'no-repeat',
    flex: '0 1 auto',
    minWidth: '160px',
  },
  counter: {
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    letterSpacing: '1px',
    color: 'var(--text-dim)',
    marginBottom: '16px',
    minHeight: '1em',
    padding: '0 8px',
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