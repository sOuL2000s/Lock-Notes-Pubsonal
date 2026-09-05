import React, { useState } from 'react';

function NoteList({ notes, onViewNote, onEditNote, onDeleteNote }) {
  const [deletePassword, setDeletePassword] = useState({});
  const [showDeletePassword, setShowDeletePassword] = useState({});

  const handleDeleteClick = (noteId) => {
    if (showDeletePassword[noteId]) {
      // Attempt delete with password
      onDeleteNote(noteId, deletePassword[noteId]);
      setShowDeletePassword({ ...showDeletePassword, [noteId]: false });
      setDeletePassword({ ...deletePassword, [noteId]: '' });
    } else {
      setShowDeletePassword({ ...showDeletePassword, [noteId]: true });
    }
  };

  return (
    <div style={styles.container}>
      {notes.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No notes yet. Create your first note!</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {notes.map((note) => (
            <div key={note._id} style={styles.card}>
              <h3 style={styles.cardTitle}>{note.title}</h3>
              <p style={styles.cardContent}>
                {note.content.length > 150 
                  ? note.content.substring(0, 150) + '...' 
                  : note.content}
              </p>
              <div style={styles.cardFooter}>
                <span style={styles.cardDate}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
                {note.password && (
                  <span style={styles.passwordBadge}>🔒 Protected</span>
                )}
              </div>
              <div style={styles.cardActions}>
                <button 
                  onClick={() => onViewNote(note._id)}
                  style={styles.viewButton}
                >
                  View
                </button>
                <button 
                  onClick={() => onEditNote(note)}
                  style={styles.editButton}
                >
                  Edit
                </button>
                {showDeletePassword[note._id] ? (
                  <div style={styles.deletePasswordContainer}>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={deletePassword[note._id] || ''}
                      onChange={(e) => setDeletePassword({
                        ...deletePassword,
                        [note._id]: e.target.value
                      })}
                      style={styles.deletePasswordInput}
                    />
                    <button
                      onClick={() => handleDeleteClick(note._id)}
                      style={styles.deleteButton}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        setShowDeletePassword({ ...showDeletePassword, [note._id]: false });
                        setDeletePassword({ ...deletePassword, [note._id]: '' });
                      }}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleDeleteClick(note._id)}
                    style={styles.deleteButton}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'flex',
    flexDirection: 'column'
  },
  cardTitle: {
    color: '#333',
    fontSize: '1.2rem',
    marginBottom: '10px'
  },
  cardContent: {
    color: '#666',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    flex: 1,
    marginBottom: '15px'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    fontSize: '0.85rem',
    color: '#999',
    borderTop: '1px solid #eee',
    paddingTop: '10px'
  },
  passwordBadge: {
    backgroundColor: '#ffd700',
    color: '#333',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  viewButton: {
    backgroundColor: '#667eea',
    color: 'white',
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flex: 1
  },
  editButton: {
    backgroundColor: '#ffa500',
    color: 'white',
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flex: 1
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    color: 'white',
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flex: 1
  },
  cancelButton: {
    backgroundColor: '#999',
    color: 'white',
    padding: '6px 14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    flex: 1
  },
  deletePasswordContainer: {
    display: 'flex',
    gap: '8px',
    width: '100%',
    flexWrap: 'wrap'
  },
  deletePasswordInput: {
    padding: '6px 10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '0.85rem',
    flex: 1,
    minWidth: '100px'
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  emptyText: {
    color: '#999',
    fontSize: '1.1rem'
  },
  cardDate: {
    fontSize: '0.8rem'
  }
};

export default NoteList;