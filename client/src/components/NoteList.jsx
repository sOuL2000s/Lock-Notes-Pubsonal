// client/src/components/NoteList.jsx
import React, { useState } from 'react';
import PasswordModal from './PasswordModal';
import { api } from '../services/api';
import { Eye, Edit, Trash2, Lock, Calendar, FileText } from 'lucide-react';

function NoteList({
  notes,
  totalCount = 0,
  searchQuery = '',
  onViewNote,
  onEditNote,
  onDeleteNote,
}) {
  const [passwordModal, setPasswordModal] = useState({
    isOpen: false,
    noteId: null,
    action: 'view',
    title: '',
    attempts: 0,
    isLocked: false,
  });

  const resetModal = () => {
    setPasswordModal({
      isOpen: false,
      noteId: null,
      action: 'view',
      title: '',
      attempts: 0,
      isLocked: false,
    });
  };

  const handleActionWithPassword = (noteId, action, title) => {
    const note = notes.find((n) => n._id === noteId);
    setPasswordModal({
      isOpen: true,
      noteId,
      action,
      title: note?.title || title || 'UNTITLED_NOTE',
      attempts: 0,
      isLocked: false,
    });
  };

  const performAction = async (noteId, action, password) => {
    try {
      if (action === 'view') {
        await onViewNote(noteId, password);
      } else if (action === 'edit') {
        await api.verifyPassword(noteId, password);
        const note = notes.find((n) => n._id === noteId);
        await onEditNote(note, password);
      } else if (action === 'delete') {
        await onDeleteNote(noteId, password);
      }
      resetModal();
    } catch (error) {
      if (error.response?.status === 401) {
        setPasswordModal((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          isOpen: true,
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
    setPasswordModal((prev) => ({ ...prev, isLocked: true }));
    setTimeout(() => {
      setPasswordModal((prev) => ({ ...prev, isLocked: false, attempts: 0 }));
    }, 30000);
  };

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <>
      <div style={styles.container}>
        {notes.length === 0 ? (
          hasSearch && totalCount > 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔍</div>
              <h3 style={styles.emptyTitle}>// NO_MATCHES_FOUND</h3>
              <p style={styles.emptyText}>
                [ NO_NOTES_MATCH "{searchQuery.trim()}" ]
              </p>
            </div>
          ) : hasSearch ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔍</div>
              <h3 style={styles.emptyTitle}>// NO_MATCHES_FOUND</h3>
              <p style={styles.emptyText}>
                [ TRY_A_DIFFERENT_QUERY_OR_CLEAR_SEARCH ]
              </p>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📡</div>
              <h3 style={styles.emptyTitle}>// NO_NOTES_FOUND</h3>
              <p style={styles.emptyText}>[ INITIALIZE_NEW_NOTE_TO_BEGIN ]</p>
            </div>
          )
        ) : (
          <div style={styles.grid}>
            {notes.map((note) => (
              <div key={note._id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{note.title}</h3>
                  <Lock size={14} style={styles.lockBadge} />
                </div>

                <p style={styles.cardContent}>
                  <FileText
                    size={14}
                    style={{ marginRight: '6px', opacity: 0.6, verticalAlign: 'middle' }}
                  />
                  ENCRYPTED_NOTE
                  {typeof note.contentLength === 'number' && (
                    <span style={styles.charMeta}>
                      [{note.contentLength} characters encrypted]
                    </span>
                  )}
                </p>

                <div style={styles.cardFooter}>
                  <span style={styles.cardDate}>
                    <Calendar size={12} style={{ marginRight: '4px' }} />
                    {new Date(note.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
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
            ))}
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
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
    gap: '20px',
    width: '100%',
  },
  card: {
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    boxShadow: 'var(--shadow-1)',
    transition: 'all var(--t-fast)',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    animation: 'fadeIn var(--t-fast) both',
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    gap: '8px',
  },
  cardTitle: {
    color: 'var(--text-strong)',
    fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
    fontWeight: '700',
    margin: 0,
    wordBreak: 'break-word',
    flex: 1,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  lockBadge: {
    color: 'var(--accent)',
    opacity: 0.6,
    flexShrink: 0,
  },
  cardContent: {
    color: 'var(--text-dim)',
    opacity: 0.9,
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
    lineHeight: '1.6',
    flex: 1,
    marginBottom: '16px',
    wordBreak: 'break-word',
    fontFamily: 'var(--font-mono)',
  },
  charMeta: {
    fontSize: '0.68rem',
    opacity: 0.55,
    display: 'block',
    marginTop: '6px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: '8px',
  },
  cardDate: {
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
  },
  protectedBadge: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '2px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.6rem, 0.8vw, 0.7rem)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    border: '1px solid var(--border)',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  viewButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '8px 12px',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: 'var(--warning-soft)',
    color: 'var(--warning)',
    padding: '8px 12px',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  deleteButton: {
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: '8px 12px',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '60px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    width: '100%',
    animation: 'fadeIn var(--t-fast) both',
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '1.2rem',
    color: 'var(--accent)',
    marginBottom: '8px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '2px',
  },
  emptyText: {
    fontSize: '0.9rem',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
  },
};

export default NoteList;