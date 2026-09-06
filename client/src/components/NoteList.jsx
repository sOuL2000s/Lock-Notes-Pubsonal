// client/src/components/NoteList.jsx
import React, { useState } from 'react';
import PasswordModal from './PasswordModal';
import { Eye, Edit, Trash2, Lock, Calendar } from 'lucide-react';

function NoteList({ notes, onViewNote, onEditNote, onDeleteNote }) {
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    noteId: null,
    action: 'view',
    title: '',
    attempts: 0,
    isLocked: false
  });

  // Reset modal state when closed
  const resetModal = () => {
    setPasswordModal({
      isOpen: false,
      noteId: null,
      action: 'view',
      title: '',
      attempts: 0,
      isLocked: false
    });
  };

  const handleActionWithPassword = (noteId, action, title) => {
    const note = notes.find(n => n._id === noteId);
    
    setPasswordModal({
      isOpen: true,
      noteId,
      action,
      title: note?.title || title || 'UNTITLED_NOTE',
      attempts: 0,
      isLocked: false
    });
  };

  const performAction = async (noteId, action, password) => {
    try {
      if (action === 'view') {
        await onViewNote(noteId, password);
      } else if (action === 'edit') {
        const note = notes.find(n => n._id === noteId);
        await onEditNote(note);
      } else if (action === 'delete') {
        await onDeleteNote(noteId, password);
      }
      resetModal();
    } catch (error) {
      if (error.response?.status === 401) {
        setPasswordModal(prev => ({
          ...prev,
          attempts: prev.attempts + 1,
          isOpen: true
        }));
      }
      throw error;
    }
  };

  const handlePasswordVerify = async (password) => {
    const { noteId, action } = passwordModal;
    await performAction(noteId, action, password);
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
            <div style={styles.emptyIcon}>📡</div>
            <h3 style={styles.emptyTitle}>// NO_NOTES_FOUND</h3>
            <p style={styles.emptyText}>[ INITIALIZE_NEW_NOTE_TO_BEGIN ]</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {notes.map((note) => {
              return (
                <div key={note._id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{note.title}</h3>
                    <Lock size={14} style={styles.lockBadge} />
                  </div>
                  
                  <p style={styles.cardContent}>
                    🔒 {note.content && note.content.length > 0 ? 'ENCRYPTED_NOTE' : 'EMPTY_NOTE'}
                    <span style={{ fontSize: '0.65rem', opacity: 0.4, display: 'block', marginTop: '4px' }}>
                      [{note.content ? note.content.length : 0} characters encrypted]
                    </span>
                  </p>
                  
                  <div style={styles.cardFooter}>
                    <span style={styles.cardDate}>
                      <Calendar size={12} style={{ marginRight: '4px' }} />
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <span style={styles.protectedBadge}>🔒 ENCRYPTED</span>
                  </div>
                  
                  <div style={styles.cardActions}>
                    <button 
                      onClick={() => handleActionWithPassword(note._id, 'view', note.title)}
                      style={styles.viewButton}
                    >
                      <Eye size={14} style={{ marginRight: '4px' }} />
                      VIEW
                    </button>
                    <button 
                      onClick={() => handleActionWithPassword(note._id, 'edit', note.title)}
                      style={styles.editButton}
                    >
                      <Edit size={14} style={{ marginRight: '4px' }} />
                      EDIT
                    </button>
                    <button 
                      onClick={() => handleActionWithPassword(note._id, 'delete', note.title)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={14} style={{ marginRight: '4px' }} />
                      DELETE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={resetModal}
        onVerify={handlePasswordVerify}
        noteTitle={passwordModal.title || 'UNTITLED_NOTE'}
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
    backgroundColor: '#0a0a0a',
    border: '1px solid rgba(0, 255, 65, 0.15)',
    borderRadius: '4px',
    padding: '20px',
    boxShadow: '0 0 20px rgba(0, 255, 65, 0.02)',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    animation: 'fadeIn 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    gap: '8px'
  },
  cardTitle: {
    color: '#00ff41',
    fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
    fontWeight: '700',
    margin: 0,
    wordBreak: 'break-word',
    flex: 1,
    fontFamily: 'monospace',
    letterSpacing: '0.5px'
  },
  lockBadge: {
    color: '#00ff41',
    opacity: 0.6,
    flexShrink: 0
  },
  cardContent: {
    color: '#00ff41',
    opacity: 0.7,
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
    lineHeight: '1.8',
    flex: 1,
    marginBottom: '16px',
    wordBreak: 'break-word',
    fontFamily: 'monospace'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 255, 65, 0.05)',
    flexWrap: 'wrap',
    gap: '8px'
  },
  cardDate: {
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    color: '#00ff41',
    opacity: 0.4,
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center'
  },
  protectedBadge: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '2px 10px',
    borderRadius: '2px',
    fontSize: 'clamp(0.6rem, 0.8vw, 0.7rem)',
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: '1px',
    border: '1px solid rgba(0, 255, 65, 0.1)'
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  viewButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '8px 12px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  editButton: {
    backgroundColor: 'rgba(255, 165, 0, 0.05)',
    color: '#ffa500',
    padding: '8px 12px',
    border: '1px solid rgba(255, 165, 0, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 0, 68, 0.05)',
    color: '#ff0044',
    padding: '8px 12px',
    border: '1px solid rgba(255, 0, 68, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#0a0a0a',
    border: '1px solid rgba(0, 255, 65, 0.1)',
    borderRadius: '4px',
    width: '100%',
    animation: 'fadeIn 0.3s ease'
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '1.2rem',
    color: '#00ff41',
    marginBottom: '8px',
    fontFamily: 'monospace',
    letterSpacing: '2px'
  },
  emptyText: {
    fontSize: '0.9rem',
    color: '#00ff41',
    opacity: 0.4,
    fontFamily: 'monospace'
  }
};

export default NoteList;