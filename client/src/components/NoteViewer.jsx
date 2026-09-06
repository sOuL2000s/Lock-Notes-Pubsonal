// client/src/components/NoteViewer.jsx
import React, { useState, useEffect } from 'react';
import PasswordModal from './PasswordModal';
import { api } from '../services/api';
import { Edit, Trash2, Lock, Unlock, Calendar, ArrowLeft } from 'lucide-react';

function NoteViewer({ note, preVerifiedPassword = '', onEdit, onDelete, onBack }) {
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState('view');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [viewPassword, setViewPassword] = useState('');

  // Check if we have a pre-verified password from the list
  useEffect(() => {
    if (preVerifiedPassword) {
      // Auto-verify with the password from the list
      handleAutoVerify(preVerifiedPassword);
    }
  }, [preVerifiedPassword]);

  // Reset verification when note changes
  useEffect(() => {
    // Only reset if we don't have a pre-verified password
    if (!preVerifiedPassword) {
      setIsPasswordVerified(false);
      setViewPassword('');
      setAttempts(0);
    }
  }, [note?._id, preVerifiedPassword]);

  const handleAutoVerify = async (password) => {
    try {
      await api.verifyPassword(note._id, password);
      setIsPasswordVerified(true);
      setViewPassword(password);
      setAttempts(0);
    } catch (error) {
      // If auto-verify fails, show password modal
      setIsPasswordVerified(false);
      setShowPasswordModal(true);
    }
  };

  const verifyPassword = async (password) => {
    try {
      await api.verifyPassword(note._id, password);
      return true;
    } catch (error) {
      if (error.message === 'INVALID_PASSWORD') {
        throw new Error('Invalid password');
      }
      throw error;
    }
  };

  const handlePasswordVerify = async (password) => {
    try {
      await verifyPassword(password);
      setIsPasswordVerified(true);
      setViewPassword(password);
      setShowPasswordModal(false);
      setAttempts(0);
      
      // Perform the requested action after verification
      if (passwordAction === 'edit') {
        onEdit(note);
      } else if (passwordAction === 'delete') {
        await onDelete(note._id, password);
      }
      return true;
    } catch (error) {
      setAttempts(prev => prev + 1);
      throw error;
    }
  };

  const handleViewRequest = () => {
    setPasswordAction('view');
    setShowPasswordModal(true);
  };

  const handleEditClick = () => {
    if (!isPasswordVerified) {
      setPasswordAction('edit');
      setShowPasswordModal(true);
    } else {
      onEdit(note);
    }
  };

  const handleDeleteClick = () => {
    if (!isPasswordVerified) {
      setPasswordAction('delete');
      setShowPasswordModal(true);
    } else {
      handleDelete(viewPassword);
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

  const handleLocked = () => {
    setIsLocked(true);
    setTimeout(() => {
      setIsLocked(false);
      setAttempts(0);
    }, 30000);
  };

  const renderContent = (content) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('### ')) {
        return <h3 key={index} style={styles.paragraphHeader}>{line.substring(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} style={styles.paragraphHeader}>{line.substring(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} style={styles.paragraphHeader}>{line.substring(2)}</h1>;
      }
      const imgMatch = line.match(/<img src="([^"]+)"[^>]*>/);
      if (imgMatch) {
        return <img key={index} src={imgMatch[1]} alt="Note image" style={styles.image} />;
      }
      const linkMatch = line.match(/\[Link: ([^\]]+)\]/);
      if (linkMatch) {
        return <p key={index} style={styles.paragraph}>🔗 {linkMatch[1]}</p>;
      }
      const boldMatch = line.match(/\*\*(.+?)\*\*/);
      if (boldMatch) {
        return <p key={index} style={styles.paragraph}><strong>{boldMatch[1]}</strong></p>;
      }
      if (line.trim()) {
        return <p key={index} style={styles.paragraph}>{line}</p>;
      }
      return <br key={index} />;
    });
  };

  // Show lock screen for all notes until password is verified
  if (!isPasswordVerified) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            BACK
          </button>
          
          <div style={styles.lockContainer}>
            <Lock size={48} style={styles.lockIcon} />
            <h3 style={styles.lockTitle}>// ENCRYPTED_NOTE</h3>
            <p style={styles.lockDescription}>
              [ DECRYPTION_KEY_REQUIRED ]
            </p>
            <button 
              onClick={handleViewRequest}
              style={styles.unlockButton}
            >
              <Unlock size={16} style={{ marginRight: '8px' }} />
              DECRYPT_NOTE
            </button>
          </div>
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordAction('view');
          }}
          onVerify={handlePasswordVerify}
          noteTitle={note?.title}
          action="view"
          attempts={attempts}
          maxAttempts={5}
          onLocked={handleLocked}
        />
      </div>
    );
  }

  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            BACK
          </button>
          
          <div style={styles.noteHeader}>
            <h2 style={styles.title}>{note.title}</h2>
            <span style={styles.verifiedBadge}>
              <Unlock size={12} style={{ marginRight: '4px' }} />
              DECRYPTED
            </span>
          </div>
          
          <div style={styles.meta}>
            <span style={styles.date}>
              <Calendar size={14} style={{ marginRight: '6px' }} />
              CREATED: {new Date(note.createdAt).toLocaleDateString()}
            </span>
            {note.updatedAt && note.updatedAt !== note.createdAt && (
              <span style={styles.date}>
                UPDATED: {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            )}
            <span style={styles.protected}>🔒 ENCRYPTED</span>
          </div>

          <div style={styles.content}>
            {renderContent(note.content)}
          </div>

          <div style={styles.actions}>
            <button 
              onClick={handleEditClick} 
              style={styles.editButton}
              disabled={loading}
            >
              <Edit size={16} style={{ marginRight: '8px' }} />
              EDIT_NOTE
            </button>
            
            <button
              onClick={handleDeleteClick}
              style={styles.deleteButton}
              disabled={loading}
            >
              {loading ? 'PROCESSING...' : (
                <>
                  <Trash2 size={16} style={{ marginRight: '8px' }} />
                  DELETE_NOTE
                </>
              )}
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
        onVerify={handlePasswordVerify}
        noteTitle={note?.title}
        action={passwordAction}
        attempts={attempts}
        maxAttempts={5}
        onLocked={handleLocked}
      />
    </>
  );
}

// Styles remain the same...
const styles = {
  container: {
    padding: '20px 0',
    animation: 'fadeIn 0.3s ease',
    width: '100%'
  },
  card: {
    backgroundColor: '#0a0a0a',
    border: '1px solid rgba(0, 255, 65, 0.15)',
    borderRadius: '4px',
    padding: 'clamp(24px, 4vw, 40px)',
    boxShadow: '0 0 40px rgba(0, 255, 65, 0.02)',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  backButton: {
    background: 'none',
    border: '1px solid rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 16px',
    marginBottom: '20px',
    borderRadius: '2px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace',
    display: 'inline-flex',
    alignItems: 'center'
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
    color: '#00ff41',
    fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
    fontWeight: '700',
    margin: 0,
    wordBreak: 'break-word',
    fontFamily: 'monospace'
  },
  verifiedBadge: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '4px 12px',
    borderRadius: '2px',
    fontSize: '0.7rem',
    fontWeight: '700',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    display: 'flex',
    alignItems: 'center'
  },
  meta: {
    display: 'flex',
    gap: 'clamp(10px, 2vw, 20px)',
    flexWrap: 'wrap',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(0, 255, 65, 0.05)'
  },
  date: {
    color: '#00ff41',
    opacity: 0.4,
    fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center'
  },
  protected: {
    backgroundColor: 'rgba(255, 165, 0, 0.05)',
    color: '#ffa500',
    padding: '2px 12px',
    borderRadius: '2px',
    fontSize: 'clamp(0.6rem, 1vw, 0.7rem)',
    fontWeight: '700',
    fontFamily: 'monospace',
    border: '1px solid rgba(255, 165, 0, 0.2)'
  },
  content: {
    marginBottom: '30px',
    lineHeight: '1.8',
    color: '#00ff41',
    opacity: 0.8,
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    fontFamily: 'monospace'
  },
  paragraph: {
    marginBottom: '12px',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  paragraphHeader: {
    marginBottom: '12px',
    color: '#00ff41',
    fontFamily: 'monospace'
  },
  image: {
    maxWidth: '100%',
    borderRadius: '4px',
    margin: '12px 0',
    border: '1px solid rgba(0, 255, 65, 0.1)'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    borderTop: '1px solid rgba(0, 255, 65, 0.05)',
    paddingTop: '20px'
  },
  editButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontWeight: '700',
    flex: 1,
    minWidth: '120px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'monospace'
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 0, 68, 0.05)',
    color: '#ff0044',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: '1px solid rgba(255, 0, 68, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontWeight: '700',
    flex: 1,
    minWidth: '120px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'monospace'
  },
  lockContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center'
  },
  lockIcon: {
    color: '#00ff41',
    marginBottom: '16px',
    opacity: 0.6
  },
  lockTitle: {
    fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
    color: '#00ff41',
    marginBottom: '8px',
    fontFamily: 'monospace',
    letterSpacing: '2px'
  },
  lockDescription: {
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    color: '#00ff41',
    opacity: 0.4,
    marginBottom: '24px',
    maxWidth: '400px',
    fontFamily: 'monospace'
  },
  unlockButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '12px 32px',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    fontSize: '0.9rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 0 20px rgba(0, 255, 65, 0.05)',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

export default NoteViewer;