import React, { useState } from 'react';
import NotePassword from './NotePassword';

function NoteViewer({ note, onEdit, onDelete, onBack }) {
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState(null);

  const handleDeleteClick = () => {
    if (note.password) {
      setPasswordAction('delete');
      setShowPasswordModal(true);
    } else {
      handleDelete('');
    }
  };

  const handleEditClick = () => {
    if (note.password) {
      setPasswordAction('edit');
      setShowPasswordModal(true);
    } else {
      onEdit(note);
    }
  };

  const handlePasswordSuccess = async (password) => {
    setShowPasswordModal(false);
    
    if (passwordAction === 'delete') {
      await handleDelete(password);
    } else if (passwordAction === 'edit') {
      onEdit(note);
    }
  };

  const handleDelete = async (password) => {
    setLoading(true);
    try {
      await onDelete(note._id, password);
    } catch (error) {
      setLoading(false);
      // Error handling is done in parent
    }
  };

  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            ← Back to all notes
          </button>
          
          <h2 style={styles.title}>{note.title}</h2>
          
          <div style={styles.meta}>
            <span style={styles.date}>
              Created: {new Date(note.createdAt).toLocaleDateString()}
            </span>
            {note.updatedAt && note.updatedAt !== note.createdAt && (
              <span style={styles.date}>
                Updated: {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            )}
            {note.password && (
              <span style={styles.protected}>🔒 Password Protected</span>
            )}
          </div>

          <div style={styles.content}>
            {note.content.split('\n').map((paragraph, index) => (
              <p key={index} style={styles.paragraph}>
                {paragraph}
              </p>
            ))}
          </div>

          <div style={styles.actions}>
            <button 
              onClick={handleEditClick} 
              style={styles.editButton}
              disabled={loading}
            >
              Edit Note
            </button>
            
            <button
              onClick={handleDeleteClick}
              style={styles.deleteButton}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Note'}
            </button>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <NotePassword
          note={note}
          action={passwordAction}
          onSuccess={handlePasswordSuccess}
          onCancel={() => {
            setShowPasswordModal(false);
            setPasswordAction(null);
          }}
        />
      )}
    </>
  );
}

const styles = {
  container: {
    padding: '20px 0',
    animation: 'slideDown 0.3s ease'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '800px',
    margin: '0 auto'
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '0.95rem',
    cursor: 'pointer',
    padding: '0 0 15px 0',
    display: 'block'
  },
  title: {
    color: '#333',
    fontSize: '2rem',
    marginBottom: '15px'
  },
  meta: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '25px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee'
  },
  date: {
    color: '#999',
    fontSize: '0.9rem'
  },
  protected: {
    backgroundColor: '#ffd700',
    color: '#333',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  content: {
    marginBottom: '30px',
    lineHeight: '1.8',
    color: '#444'
  },
  paragraph: {
    marginBottom: '15px'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    borderTop: '1px solid #eee',
    paddingTop: '20px'
  },
  editButton: {
    backgroundColor: '#ffa500',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 'bold'
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 'bold'
  },
  cancelButton: {
    backgroundColor: '#999',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.95rem'
  },
  deletePasswordContainer: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    width: '100%'
  },
  deletePasswordInput: {
    padding: '10px 15px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '0.95rem',
    flex: 1,
    minWidth: '150px'
  }
};

export default NoteViewer;