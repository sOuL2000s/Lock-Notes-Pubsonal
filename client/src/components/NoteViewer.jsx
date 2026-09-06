import React, { useState } from 'react';
import PasswordModal from './PasswordModal';

function NoteViewer({ note, onEdit, onDelete, onBack }) {
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState('view');
  const [isLocked, setIsLocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  // Check if password is required for viewing
  const needsPasswordForView = note?.password && !isPasswordVerified;

  const handleViewRequest = () => {
    if (note.password && !isPasswordVerified) {
      setPasswordAction('view');
      setShowPasswordModal(true);
    }
  };

  const handleEditClick = () => {
    if (note.password && !isPasswordVerified) {
      setPasswordAction('edit');
      setShowPasswordModal(true);
    } else {
      onEdit(note);
    }
  };

  const handleDeleteClick = () => {
    if (note.password && !isPasswordVerified) {
      setPasswordAction('delete');
      setShowPasswordModal(true);
    } else {
      handleDelete('');
    }
  };

  const handlePasswordVerify = async (password) => {
    try {
      // Verify the password by attempting to get the note with password
      // Or by checking against the stored hash
      // For now, we'll use the existing API verification
      await onDelete(note._id, password); // This will fail if wrong password
      // If successful, mark as verified
      setIsPasswordVerified(true);
      setShowPasswordModal(false);
      setAttempts(0);
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        setAttempts(prev => prev + 1);
        throw error;
      }
      throw error;
    }
  };

  const handleDelete = async (password) => {
    setLoading(true);
    try {
      await onDelete(note._id, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const handlePasswordSuccess = async (password) => {
    setShowPasswordModal(false);
    
    if (passwordAction === 'view') {
      // Just verify and show the note
      try {
        await handlePasswordVerify(password);
        setIsPasswordVerified(true);
      } catch (error) {
        // Password verification failed, but we'll let the modal handle it
        throw error;
      }
    } else if (passwordAction === 'edit') {
      // Verify first, then proceed to edit
      try {
        await handlePasswordVerify(password);
        onEdit(note);
      } catch (error) {
        throw error;
      }
    } else if (passwordAction === 'delete') {
      // Verify first, then delete
      try {
        await handlePasswordVerify(password);
        await handleDelete(password);
      } catch (error) {
        throw error;
      }
    }
  };

  const handleLocked = () => {
    setIsLocked(true);
    setTimeout(() => {
      setIsLocked(false);
      setAttempts(0);
    }, 30000);
  };

  // If password is required for viewing, show a lock screen
  if (needsPasswordForView) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            ← Back to all notes
          </button>
          
          <div style={styles.lockContainer}>
            <div style={styles.lockIcon}>🔒</div>
            <h3 style={styles.lockTitle}>Password Protected</h3>
            <p style={styles.lockDescription}>
              This note is encrypted. Please verify your identity to view its contents.
            </p>
            <button 
              onClick={handleViewRequest}
              style={styles.unlockButton}
            >
              Enter Password to View
            </button>
          </div>
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordAction('view');
          }}
          onVerify={handlePasswordSuccess}
          noteTitle={note?.title}
          action="view"
          attempts={attempts}
          maxAttempts={5}
          onLocked={handleLocked}
        />
      </div>
    );
  }

  // Show the note content after verification
  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            ← Back to all notes
          </button>
          
          <div style={styles.noteHeader}>
            <h2 style={styles.title}>{note.title}</h2>
            {note.password && (
              <span style={styles.verifiedBadge}>🔓 Verified</span>
            )}
          </div>
          
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
              ✏️ Edit Note
            </button>
            
            <button
              onClick={handleDeleteClick}
              style={styles.deleteButton}
              disabled={loading}
            >
              {loading ? 'Deleting...' : '🗑️ Delete Note'}
            </button>
          </div>
        </div>
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordAction('view');
        }}
        onVerify={handlePasswordSuccess}
        noteTitle={note?.title}
        action={passwordAction}
        attempts={attempts}
        maxAttempts={5}
        onLocked={handleLocked}
      />
    </>
  );
}

const styles = {
  container: {
    padding: '20px 0',
    animation: 'fadeIn 0.3s ease',
    width: '100%'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius, 12px)',
    padding: 'clamp(24px, 4vw, 40px)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'var(--primary, #4F46E5)',
    fontSize: 'clamp(0.85rem, 1.5vw, 0.95rem)',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '0 0 16px 0',
    display: 'block',
    width: '100%',
    textAlign: 'left',
    transition: 'var(--transition, all 0.3s ease)'
  },
  noteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '12px'
  },
  title: {
    color: 'var(--gray-900, #111827)',
    fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
    fontWeight: '700',
    margin: 0,
    wordBreak: 'break-word'
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  meta: {
    display: 'flex',
    gap: 'clamp(10px, 2vw, 20px)',
    flexWrap: 'wrap',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--gray-200, #E5E7EB)'
  },
  date: {
    color: 'var(--gray-500, #6B7280)',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)'
  },
  protected: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: '2px 12px',
    borderRadius: '20px',
    fontSize: 'clamp(0.7rem, 1vw, 0.8rem)',
    fontWeight: '600'
  },
  content: {
    marginBottom: '30px',
    lineHeight: '1.8',
    color: 'var(--gray-700, #374151)',
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)'
  },
  paragraph: {
    marginBottom: '16px',
    wordBreak: 'break-word'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    borderTop: '1px solid var(--gray-200, #E5E7EB)',
    paddingTop: '20px'
  },
  editButton: {
    backgroundColor: 'var(--primary, #4F46E5)',
    color: 'white',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
    transition: 'var(--transition, all 0.3s ease)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  deleteButton: {
    backgroundColor: 'var(--danger, #EF4444)',
    color: 'white',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    cursor: 'pointer',
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
    transition: 'var(--transition, all 0.3s ease)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  lockContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center'
  },
  lockIcon: {
    fontSize: '4rem',
    marginBottom: '16px'
  },
  lockTitle: {
    fontSize: 'clamp(1.3rem, 2.5vw, 1.6rem)',
    color: 'var(--gray-800, #1F2937)',
    marginBottom: '8px'
  },
  lockDescription: {
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    color: 'var(--gray-500, #6B7280)',
    marginBottom: '24px',
    maxWidth: '400px'
  },
  unlockButton: {
    backgroundColor: 'var(--primary, #4F46E5)',
    color: 'white',
    padding: '12px 32px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition, all 0.3s ease)',
    boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1))'
  }
};

export default NoteViewer;