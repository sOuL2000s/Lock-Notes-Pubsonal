import React, { useState, useEffect } from 'react';
import NoteList from './components/NoteList';
import NoteEditor from './components/NoteEditor';
import NoteViewer from './components/NoteViewer';
import { api } from './services/api';

function App() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'edit', 'view'
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
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>📝 Note Sharing</h1>
        <p style={styles.subtitle}>Create, share, and discover public notes</p>
      </header>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
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
            + Create New Note
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
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    color: 'white'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
    textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
  },
  subtitle: {
    fontSize: '1.1rem',
    opacity: 0.9
  },
  createButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginBottom: '20px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: 'white'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid rgba(255,255,255,0.3)',
    borderTop: '5px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  error: {
    backgroundColor: '#ff4444',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    animation: 'slideDown 0.3s ease'
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0 5px'
  }
};

// Add keyframes to document
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes slideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(styleSheet);

export default App;