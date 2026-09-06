import React, { useState } from 'react';
import PasswordModal from './PasswordModal';

function NoteList({ notes, onViewNote, onEditNote, onDeleteNote }) {
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    noteId: null,
    action: 'view',
    title: '',
    attempts: 0,
    isLocked: false
  });

  const handleActionWithPassword = (noteId, action, title) => {
    const note = notes.find(n => n._id === noteId);
    if (note?.password) {
      setPasswordModal({
        isOpen: true,
        noteId,
        action,
        title: title || note.title,
        attempts: 0,
        isLocked: false
      });
    } else {
      performAction(noteId, action, '');
    }
  };

  const performAction = async (noteId, action, password) => {
    try {
      if (action === 'view') {
        await onViewNote(noteId);
      } else if (action === 'edit') {
        const note = notes.find(n => n._id === noteId);
        await onEditNote(note);
      } else if (action === 'delete') {
        await onDeleteNote(noteId, password);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setPasswordModal(prev => ({
          ...prev,
          attempts: prev.attempts + 1
        }));
        throw error;
      }
      throw error;
    }
  };

  const handlePasswordVerify = async (password) => {
    const { noteId, action } = passwordModal;
    await performAction(noteId, action, password);
    setPasswordModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleLocked = () => {
    setPasswordModal(prev => ({ ...prev, isLocked: true }));
    setTimeout(() => {
      setPasswordModal(prev => ({ ...prev, isLocked: false, attempts: 0 }));
    }, 30000);
  };

  return (
    <>
      <div style={styles.container}>
        {notes.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>📝</span>
            <h3 style={styles.emptyTitle}>No notes yet</h3>
            <p style={styles.emptyText}>Create your first note to get started</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {notes.map((note) => (
              <div key={note._id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{note.title}</h3>
                  {note.password && (
                    <span style={styles.lockBadge}>🔒</span>
                  )}
                </div>
                
                <p style={styles.cardContent}>
                  {note.content.length > 120 
                    ? note.content.substring(0, 120) + '...' 
                    : note.content}
                </p>
                
                <div style={styles.cardFooter}>
                  <span style={styles.cardDate}>
                    {new Date(note.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                  {note.password && (
                    <span style={styles.protectedBadge}>🔒 Protected</span>
                  )}
                </div>
                
                <div style={styles.cardActions}>
                  <button 
                    onClick={() => handleActionWithPassword(note._id, 'view', note.title)}
                    style={styles.viewButton}
                  >
                    👁️ View
                  </button>
                  <button 
                    onClick={() => handleActionWithPassword(note._id, 'edit', note.title)}
                    style={styles.editButton}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleActionWithPassword(note._id, 'delete', note.title)}
                    style={styles.deleteButton}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
        onVerify={handlePasswordVerify}
        noteTitle={passwordModal.title}
        action={passwordModal.action}
        attempts={passwordModal.attempts}
        maxAttempts={5}
        onLocked={handleLocked}
      />
    </>
  );
}

const styles = {
  container: {
    padding: '20px 0',
    width: '100%'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
    gap: '20px',
    width: '100%'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius, 12px)',
    padding: '20px',
    boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1))',
    transition: 'var(--transition, all 0.3s ease)',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    animation: 'fadeIn 0.3s ease'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    gap: '8px'
  },
  cardTitle: {
    color: 'var(--gray-800, #1F2937)',
    fontSize: 'clamp(1.1rem, 1.8vw, 1.2rem)',
    fontWeight: '600',
    margin: 0,
    wordBreak: 'break-word',
    flex: 1
  },
  lockBadge: {
    fontSize: '1rem',
    flexShrink: 0
  },
  cardContent: {
    color: 'var(--gray-600, #4B5563)',
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
    lineHeight: '1.6',
    flex: 1,
    marginBottom: '16px',
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--gray-200, #E5E7EB)',
    flexWrap: 'wrap',
    gap: '8px'
  },
  cardDate: {
    fontSize: 'clamp(0.75rem, 1vw, 0.85rem)',
    color: 'var(--gray-400, #9CA3AF)'
  },
  protectedBadge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: 'clamp(0.65rem, 0.8vw, 0.75rem)',
    fontWeight: '600'
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  viewButton: {
    backgroundColor: 'var(--primary, #4F46E5)',
    color: 'white',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1vw, 0.85rem)',
    fontWeight: '500',
    flex: 1,
    minWidth: '60px',
    transition: 'var(--transition, all 0.3s ease)'
  },
  editButton: {
    backgroundColor: 'var(--warning, #F59E0B)',
    color: 'white',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1vw, 0.85rem)',
    fontWeight: '500',
    flex: 1,
    minWidth: '60px',
    transition: 'var(--transition, all 0.3s ease)'
  },
  deleteButton: {
    backgroundColor: 'var(--danger, #EF4444)',
    color: 'white',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1vw, 0.85rem)',
    fontWeight: '500',
    flex: 1,
    minWidth: '60px',
    transition: 'var(--transition, all 0.3s ease)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: 'var(--radius, 12px)',
    boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1))',
    width: '100%',
    animation: 'fadeIn 0.3s ease'
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '1.3rem',
    color: 'var(--gray-700, #374151)',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '1rem',
    color: 'var(--gray-400, #9CA3AF)'
  }
};

export default NoteList;