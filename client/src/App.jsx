import React, { useState, useEffect } from 'react';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteViewer from './components/NoteViewer';
import { api } from './services/api';

function App() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await api.getNotes();
      setNotes(data.notes || []);
      setError(null);
    } catch (err) {
      setError('Failed to load notes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (noteData) => {
    try {
      const newNote = await api.createNote(noteData);
      setNotes([newNote, ...notes]);
      setViewMode('list');
      setCurrentNote(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create note');
      throw err;
    }
  };

  const handleUpdateNote = async (id, noteData) => {
    try {
      const updatedNote = await api.updateNote(id, noteData);
      setNotes(notes.map(n => n._id === id ? updatedNote : n));
      setViewMode('list');
      setCurrentNote(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update note');
      throw err;
    }
  };

  const handleDeleteNote = async (id, password) => {
    try {
      await api.deleteNote(id, password);
      setNotes(notes.filter(n => n._id !== id));
      if (currentNote?._id === id) {
        setCurrentNote(null);
        setViewMode('list');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete note');
      throw err;
    }
  };

  const handleViewNote = async (id) => {
    try {
      const note = await api.getNote(id);
      setCurrentNote(note);
      setViewMode('view');
    } catch (err) {
      setError('Failed to load note');
      console.error(err);
    }
  };

  const handleEditNote = (note) => {
    setCurrentNote(note);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setCurrentNote(null);
    setError(null);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>📝 NoteShare</h1>
          <p style={styles.tagline}>Secure note sharing with password protection</p>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <span style={styles.errorText}>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          <button 
            onClick={() => {
              setCurrentNote(null);
              setViewMode('create');
            }}
            style={styles.createButton}
          >
            <span style={styles.createIcon}>+</span>
            Create New Note
          </button>
          <NoteList 
            notes={notes} 
            onViewNote={handleViewNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
          />
        </>
      )}

      {(viewMode === 'create' || viewMode === 'edit') && (
        <NoteEditor
          note={viewMode === 'edit' ? currentNote : null}
          onSave={viewMode === 'edit' ? handleUpdateNote : handleCreateNote}
          onCancel={handleBackToList}
        />
      )}

      {viewMode === 'view' && currentNote && (
        <NoteViewer
          note={currentNote}
          onEdit={() => handleEditNote(currentNote)}
          onDelete={handleDeleteNote}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '20px',
    width: '100%'
  },
  header: {
    marginBottom: '32px',
    textAlign: 'center',
    animation: 'fadeIn 0.5s ease'
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  logo: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: '800',
    color: 'white',
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
    letterSpacing: '-0.5px'
  },
  tagline: {
    fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400'
  },
  createButton: {
    backgroundColor: 'white',
    color: 'var(--primary)',
    padding: 'clamp(12px, 2vw, 16px) clamp(20px, 3vw, 32px)',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'var(--transition)',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    maxWidth: '320px',
    marginLeft: 'auto',
    marginRight: 'auto'
  },
  createButtonHover: {
    transform: 'translateY(-2px)',
    boxShadow: 'var(--shadow-xl)'
  },
  createIcon: {
    fontSize: '1.5rem',
    fontWeight: '300'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh'
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(255,255,255,0.2)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    color: 'white',
    fontSize: '1rem',
    fontWeight: '500'
  },
  errorBanner: {
    backgroundColor: 'white',
    color: 'var(--danger)',
    padding: 'clamp(12px, 2vw, 16px) clamp(16px, 2.5vw, 24px)',
    borderRadius: 'var(--radius)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: 'var(--shadow-md)',
    animation: 'fadeIn 0.3s ease'
  },
  errorIcon: {
    fontSize: '1.2rem'
  },
  errorText: {
    flex: 1,
    fontSize: 'clamp(0.9rem, 1.2vw, 1rem)'
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: 'var(--gray-400)',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition)'
  }
};

// Add keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default App;