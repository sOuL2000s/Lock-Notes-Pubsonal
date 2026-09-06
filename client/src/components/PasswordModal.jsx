import React, { useState, useEffect } from 'react';

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
      setError('Please enter a password');
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
        setError(`Too many failed attempts. Account locked for 30 seconds.`);
        onLocked();
        setTimeout(() => {
          setRemainingAttempts(maxAttempts);
        }, 30000);
      } else {
        setError(`Invalid password. ${maxAttempts - newAttempts} attempts remaining.`);
      }
      setPassword('');
      setLoading(false);
    }
  };

  const actionLabels = {
    view: 'View',
    edit: 'Edit',
    delete: 'Delete',
    create: 'Create'
  };

  const actionLabel = actionLabels[action] || 'Access';

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <span style={styles.icon}>🔒</span>
          </div>
          <div style={styles.headerText}>
            <h3 style={styles.title}>Password Required</h3>
            <p style={styles.subtitle}>
              Enter the password to {actionLabel.toLowerCase()} this note
            </p>
          </div>
          <button onClick={onClose} style={styles.closeButton} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={styles.noteInfo}>
          <span style={styles.noteLabel}>Note:</span>
          <span style={styles.noteTitle}>{noteTitle || 'Untitled Note'}</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.passwordField}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter note password"
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
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={error.includes('locked') ? styles.lockedMessage : styles.error}>
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
                `Unlock & ${actionLabel}`
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>
            💡 This note is protected with a password. 
            {remainingAttempts > 0 && remainingAttempts < maxAttempts && (
              <span style={styles.attemptsInfo}>
                {' '}{remainingAttempts} attempts remaining
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    animation: 'fadeIn 0.25s ease'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg, 16px)',
    padding: 'clamp(24px, 4vw, 40px)',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    animation: 'slideUp 0.3s ease',
    maxHeight: '90vh',
    overflowY: 'auto'
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
    borderRadius: '50%',
    background: 'var(--primary-gradient, linear-gradient(135deg, #4F46E5, #7C3AED))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  icon: {
    fontSize: '1.5rem'
  },
  headerText: {
    flex: 1
  },
  title: {
    fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
    fontWeight: '700',
    color: 'var(--gray-900, #111827)',
    margin: 0
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--gray-500, #6B7280)',
    margin: '4px 0 0 0'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    color: 'var(--gray-400, #9CA3AF)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm, 6px)',
    transition: 'var(--transition, all 0.3s ease)',
    flexShrink: 0
  },
  noteInfo: {
    backgroundColor: 'var(--gray-50, #F9FAFB)',
    padding: '12px 16px',
    borderRadius: 'var(--radius-sm, 6px)',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  noteLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--gray-500, #6B7280)'
  },
  noteTitle: {
    fontSize: '0.95rem',
    fontWeight: '500',
    color: 'var(--gray-800, #1F2937)',
    wordBreak: 'break-word'
  },
  passwordField: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--gray-700, #374151)',
    marginBottom: '6px'
  },
  inputWrapper: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    paddingRight: '48px',
    border: '2px solid var(--gray-200, #E5E7EB)',
    borderRadius: 'var(--radius-sm, 6px)',
    fontSize: '1rem',
    transition: 'var(--transition, all 0.3s ease)',
    outline: 'none',
    backgroundColor: 'white'
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '4px',
    color: 'var(--gray-400, #9CA3AF)'
  },
  error: {
    backgroundColor: '#FEF2F2',
    color: 'var(--danger, #EF4444)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm, 6px)',
    marginBottom: '16px',
    fontSize: '0.9rem',
    border: '1px solid #FECACA'
  },
  lockedMessage: {
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm, 6px)',
    marginBottom: '16px',
    fontSize: '0.9rem',
    border: '1px solid #FDE68A'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px'
  },
  submitButton: {
    backgroundColor: 'var(--primary, #4F46E5)',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    flex: 1,
    transition: 'var(--transition, all 0.3s ease)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100px'
  },
  cancelButton: {
    backgroundColor: 'var(--gray-100, #F3F4F6)',
    color: 'var(--gray-600, #4B5563)',
    padding: '12px 24px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    flex: 1,
    minWidth: '100px',
    transition: 'var(--transition, all 0.3s ease)'
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid var(--gray-200, #E5E7EB)'
  },
  hint: {
    fontSize: '0.85rem',
    color: 'var(--gray-500, #6B7280)',
    margin: 0,
    lineHeight: '1.5'
  },
  attemptsInfo: {
    fontWeight: '600',
    color: 'var(--warning, #F59E0B)'
  }
};

export default PasswordModal;