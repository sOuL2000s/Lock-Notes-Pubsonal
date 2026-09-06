// client/src/components/PasswordModal.jsx
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Key, AlertTriangle } from 'lucide-react';

function PasswordModal({ 
  isOpen, 
  onClose, 
  onVerify, 
  noteTitle,
  action = 'view',
  attempts = 0,
  maxAttempts = 5,
  onLocked 
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(maxAttempts);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setLoading(false);
      setRemainingAttempts(maxAttempts - attempts);
    }
  }, [isOpen, attempts, maxAttempts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('ACCESS DENIED: Password required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onVerify(password);
      setPassword('');
      setLoading(false);
    } catch (err) {
      const newAttempts = attempts + 1;
      setRemainingAttempts(maxAttempts - newAttempts);
      
      if (newAttempts >= maxAttempts) {
        setError('⚠️ SYSTEM LOCKED: Maximum attempts exceeded. Cooldown: 30s');
        onLocked();
        setTimeout(() => {
          setRemainingAttempts(maxAttempts);
        }, 30000);
      } else {
        setError(`❌ INVALID CREDENTIALS: ${maxAttempts - newAttempts} attempts remaining`);
      }
      setPassword('');
      setLoading(false);
    }
  };

  const actionLabels = {
    view: 'VIEW',
    edit: 'MODIFY',
    delete: 'TERMINATE',
    create: 'INITIALIZE'
  };

  const actionLabel = actionLabels[action] || 'ACCESS';

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.glitchLine} />
        
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <Lock size={28} color="#00ff41" strokeWidth={1.5} />
          </div>
          <div style={styles.headerText}>
            <h3 style={styles.title}>// SECURE_ACCESS_REQUIRED</h3>
            <p style={styles.subtitle}>
              {actionLabel}_OPERATION: {noteTitle || 'UNTITLED_NOTE'}
            </p>
          </div>
          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div style={styles.noteInfo}>
          <span style={styles.noteLabel}>TARGET:</span>
          <span style={styles.noteTitle}>{noteTitle || 'UNTITLED_NOTE'}</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.passwordField}>
            <label style={styles.label}>ENCRYPTION_KEY</label>
            <div style={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter decryption key..."
                style={styles.input}
                disabled={loading}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={error.includes('LOCKED') ? styles.lockedMessage : styles.error}>
              <AlertTriangle size={16} style={{ marginRight: '8px' }} />
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <span style={styles.loadingSpinner}></span>
              ) : (
                <>
                  <Key size={18} style={{ marginRight: '8px' }} />
                  {actionLabel}_ACCESS
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={loading}
            >
              ABORT
            </button>
          </div>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>
            [SECURITY_PROTOCOL] {remainingAttempts > 0 && remainingAttempts < maxAttempts && (
              <span style={styles.attemptsInfo}>
                {remainingAttempts} attempts remaining
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    animation: 'fadeIn 0.3s ease'
  },
  modal: {
    backgroundColor: '#0a0a0a',
    border: '2px solid #00ff41',
    borderRadius: '4px',
    padding: 'clamp(24px, 4vw, 40px)',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 0 40px rgba(0, 255, 65, 0.2), inset 0 0 40px rgba(0, 255, 65, 0.05)',
    animation: 'slideUp 0.3s ease',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative'
  },
  glitchLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #00ff41, transparent)',
    animation: 'glitchLine 2s infinite'
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '24px'
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    border: '1px solid #00ff41',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'rgba(0, 255, 65, 0.05)'
  },
  headerText: {
    flex: 1
  },
  title: {
    fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
    fontWeight: '700',
    color: '#00ff41',
    margin: 0,
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#00ff41',
    opacity: 0.7,
    margin: '4px 0 0 0',
    fontFamily: 'monospace'
  },
  closeButton: {
    background: 'none',
    border: '1px solid #00ff41',
    fontSize: '1rem',
    color: '#00ff41',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '2px',
    transition: 'all 0.3s ease',
    flexShrink: 0,
    fontFamily: 'monospace',
    background: 'rgba(0, 255, 65, 0.05)'
  },
  noteInfo: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    padding: '12px 16px',
    borderRadius: '2px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    border: '1px solid rgba(0, 255, 65, 0.2)'
  },
  noteLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#00ff41',
    opacity: 0.6,
    fontFamily: 'monospace'
  },
  noteTitle: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: '#00ff41',
    wordBreak: 'break-word',
    fontFamily: 'monospace'
  },
  passwordField: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#00ff41',
    opacity: 0.6,
    marginBottom: '6px',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  inputWrapper: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    paddingRight: '48px',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    fontFamily: 'monospace',
    boxShadow: 'inset 0 0 20px rgba(0, 255, 65, 0.05)'
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    color: '#00ff41',
    opacity: 0.6,
    transition: 'opacity 0.3s ease'
  },
  error: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    color: '#ff0044',
    padding: '10px 14px',
    borderRadius: '2px',
    marginBottom: '16px',
    fontSize: '0.8rem',
    border: '1px solid #ff0044',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center'
  },
  lockedMessage: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    color: '#ffa500',
    padding: '10px 14px',
    borderRadius: '2px',
    marginBottom: '16px',
    fontSize: '0.8rem',
    border: '1px solid #ffa500',
    fontFamily: 'monospace',
    display: 'flex',
    alignItems: 'center'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px'
  },
  submitButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    padding: '12px 24px',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    fontSize: '0.85rem',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100px',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#666',
    padding: '12px 24px',
    border: '1px solid #333',
    borderRadius: '2px',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    flex: 1,
    minWidth: '100px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace'
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(0, 255, 65, 0.2)',
    borderTopColor: '#00ff41',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 255, 65, 0.1)'
  },
  hint: {
    fontSize: '0.7rem',
    color: '#00ff41',
    opacity: 0.4,
    margin: 0,
    lineHeight: '1.5',
    fontFamily: 'monospace'
  },
  attemptsInfo: {
    fontWeight: '700',
    color: '#00ff41',
    opacity: 0.8
  }
};

export default PasswordModal;