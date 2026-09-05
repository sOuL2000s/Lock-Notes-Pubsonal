import React, { useState } from 'react';

function NotePassword({ note, onSuccess, onCancel, action = 'view' }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSuccess(password);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid password. Please try again.');
      setLoading(false);
    }
  };

  const actionLabels = {
    view: 'View',
    edit: 'Edit',
    delete: 'Delete'
  };

  const actionLabel = actionLabels[action] || 'Access';

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.icon}>🔒</span>
          <h3 style={styles.title}>Password Required</h3>
        </div>
        
        <p style={styles.description}>
          This note is password protected. Enter the password to {actionLabel.toLowerCase()} it.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Note Title</label>
            <div style={styles.noteTitle}>{note?.title || 'Untitled Note'}</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter note password"
              style={styles.input}
              disabled={loading}
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Verifying...' : actionLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>
            💡 This note is publicly visible but requires a password for {actionLabel.toLowerCase()} actions.
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    animation: 'fadeIn 0.3s ease'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '35px',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    animation: 'slideUp 0.3s ease'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  },
  icon: {
    fontSize: '2rem'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    color: '#333'
  },
  description: {
    color: '#666',
    marginBottom: '25px',
    lineHeight: '1.5'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    color: '#555',
    marginBottom: '6px',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  noteTitle: {
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    color: '#333',
    fontWeight: '500',
    fontSize: '0.95rem'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  inputFocus: {
    borderColor: '#667eea'
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '10px 14px',
    borderRadius: '6px',
    marginBottom: '15px',
    fontSize: '0.9rem',
    border: '1px solid #fcc'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '5px'
  },
  submitButton: {
    backgroundColor: '#667eea',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1,
    transition: 'opacity 0.2s, transform 0.2s'
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    color: '#666',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    flex: 1,
    transition: 'background-color 0.2s'
  },
  footer: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #eee'
  },
  hint: {
    color: '#999',
    fontSize: '0.85rem',
    margin: 0,
    lineHeight: '1.4'
  }
};

// Add animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(styleSheet);

export default NotePassword;