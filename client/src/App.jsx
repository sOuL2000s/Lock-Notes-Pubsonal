// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteViewer from './components/NoteViewer';
import { api } from './services/api';
import { Terminal, Plus, AlertTriangle } from 'lucide-react';

function App() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Add state for pre-verified password
  const [preVerifiedPassword, setPreVerifiedPassword] = useState('');

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
      setError('FAILED_TO_LOAD_NOTES');
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
      setPreVerifiedPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'CREATE_FAILED');
      throw err;
    }
  };

  const handleUpdateNote = async (id, noteData) => {
    try {
      const updatedNote = await api.updateNote(id, noteData);
      setNotes(notes.map(n => n._id === id ? updatedNote : n));
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
      setNotes(notes.filter(n => n._id !== id));
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
      setPreVerifiedPassword(preVerifiedPassword); // Store the password for viewer
      setViewMode('view');
    } catch (err) {
      setError('LOAD_NOTE_FAILED');
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
    setPreVerifiedPassword('');
  };

  if (loading) {
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
          <Terminal size={28} color="#00ff41" />
          <h1 style={styles.logo}>// NOTE_SHARE</h1>
          <p style={styles.tagline}>[ SECURE_NOTE_SYSTEM ]</p>
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
              setCurrentNote(null);
              setViewMode('create');
              setPreVerifiedPassword('');
            }}
            style={styles.createButton}
          >
            <Plus size={18} style={styles.createIcon} />
            CREATE_NOTE
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
          preVerifiedPassword={preVerifiedPassword}
          onEdit={() => handleEditNote(currentNote)}
          onDelete={handleDeleteNote}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
}

// Styles remain the same...
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
    gap: '4px'
  },
  logo: {
    fontSize: 'clamp(2rem, 5vw, 3rem)',
    fontWeight: '800',
    color: '#00ff41',
    textShadow: '0 0 20px rgba(0, 255, 65, 0.3)',
    letterSpacing: '2px',
    fontFamily: 'monospace'
  },
  tagline: {
    fontSize: 'clamp(0.7rem, 1.5vw, 0.9rem)',
    color: '#00ff41',
    opacity: 0.5,
    fontWeight: '400',
    fontFamily: 'monospace',
    letterSpacing: '4px'
  },
  createButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: 'clamp(12px, 2vw, 16px) clamp(20px, 3vw, 32px)',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'all 0.3s ease',
    boxShadow: '0 0 20px rgba(0, 255, 65, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    maxWidth: '320px',
    marginLeft: 'auto',
    marginRight: 'auto',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  createIcon: {
    fontSize: '1.2rem'
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0a0a0a'
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
    border: '3px solid rgba(0, 255, 65, 0.1)',
    borderTopColor: '#00ff41',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    color: '#00ff41',
    fontSize: '0.9rem',
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: '2px',
    opacity: 0.6
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 0, 68, 0.1)',
    color: '#ff0044',
    padding: 'clamp(12px, 2vw, 16px) clamp(16px, 2.5vw, 24px)',
    borderRadius: '2px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #ff0044',
    animation: 'fadeIn 0.3s ease',
    fontFamily: 'monospace'
  },
  errorIcon: {
    flexShrink: 0
  },
  errorText: {
    flex: 1,
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)'
  },
  errorClose: {
    background: 'none',
    border: '1px solid #ff0044',
    color: '#ff0044',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '2px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace'
  }
};

export default App;