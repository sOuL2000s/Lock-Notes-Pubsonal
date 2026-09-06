import React, { useState, useEffect } from 'react';
import PasswordStrength from './PasswordStrength';

function NoteEditor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({ isValid: false, message: '' });

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setIsPasswordProtected(!!note.password);
    } else {
      setTitle('');
      setContent('');
      setPassword('');
      setCurrentPassword('');
      setIsPasswordProtected(false);
      setPasswordValidation({ isValid: false, message: '' });
    }
  }, [note]);

  const validatePassword = (pwd) => {
    if (!pwd) {
      setPasswordValidation({ isValid: false, message: 'Password is required for protected notes' });
      return false;
    }
    
    const hasMinLength = pwd.length >= 8;
    const hasLowercase = /[a-z]/.test(pwd);
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    
    const score = [hasMinLength, hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;
    
    if (score < 3) {
      setPasswordValidation({ 
        isValid: false, 
        message: 'Password is too weak. Please include at least 8 characters, uppercase, lowercase, and a number or special character.' 
      });
      return false;
    }
    
    setPasswordValidation({ isValid: true, message: 'Strong password!' });
    return true;
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (isPasswordProtected) {
      validatePassword(newPassword);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        password: isPasswordProtected ? password : undefined,
        currentPassword: note?.password ? currentPassword : undefined
      };

      if (!noteData.title) {
        setError('Title is required');
        setLoading(false);
        return;
      }

      if (!noteData.content) {
        setError('Content is required');
        setLoading(false);
        return;
      }

      if (isPasswordProtected) {
        if (!password) {
          setError('Password is required for protected notes');
          setLoading(false);
          return;
        }
        if (!validatePassword(password)) {
          setError(passwordValidation.message);
          setLoading(false);
          return;
        }
      }

      if (note?.password && !currentPassword) {
        setError('Current password is required to update this note');
        setLoading(false);
        return;
      }

      if (note) {
        await onSave(note._id, noteData);
      } else {
        await onSave(noteData);
      }
    } catch (err) {
      setError(err.message || 'Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {note ? 'Edit Note' : 'Create New Note'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Note Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a unique note title"
              style={styles.input}
              disabled={loading}
              maxLength={100}
            />
            <div style={styles.charCount}>{title.length}/100</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note content here..."
              style={styles.textarea}
              rows="10"
              disabled={loading}
            />
          </div>

          {note?.password && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Current Password *</label>
              <div style={styles.passwordInputWrapper}>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password to update"
                  style={styles.passwordInput}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={styles.eyeButton}
                  aria-label="Toggle password visibility"
                >
                  {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => {
                  setIsPasswordProtected(e.target.checked);
                  if (!e.target.checked) {
                    setPassword('');
                    setPasswordValidation({ isValid: false, message: '' });
                  }
                }}
                style={styles.checkbox}
                disabled={loading}
              />
              🔒 Password Protect Note
            </label>
            
            {isPasswordProtected && (
              <>
                <div style={styles.passwordInputWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder={note?.password ? "New password (leave blank to keep current)" : "Enter password"}
                    style={styles.passwordInput}
                    disabled={loading}
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
                <PasswordStrength password={password} />
                {passwordValidation.message && (
                  <div style={{
                    ...styles.validationMessage,
                    color: passwordValidation.isValid ? '#4CAF50' : '#ff4444'
                  }}>
                    {passwordValidation.message}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.saveButton}
              disabled={loading}
            >
              {loading ? 'Saving...' : (note ? 'Update Note' : 'Create Note')}
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
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px 0',
    animation: 'slideDown 0.3s ease',
    width: '100%'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: 'clamp(20px, 4vw, 30px)',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '700px',
    margin: '0 auto',
    width: '100%'
  },
  title: {
    color: '#333',
    marginBottom: '25px',
    fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
    wordBreak: 'break-word'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    color: '#555',
    marginBottom: '8px',
    fontWeight: '500',
    fontSize: 'clamp(0.9rem, 1.5vw, 1rem)'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    color: '#555',
    fontWeight: '500',
    fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
    cursor: 'pointer',
    gap: '8px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    outline: 'none',
    minHeight: '150px'
  },
  passwordInputWrapper: {
    position: 'relative',
    width: '100%'
  },
  passwordInput: {
    width: '100%',
    padding: '10px 12px',
    paddingRight: '45px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '5px',
    color: '#666'
  },
  checkbox: {
    marginRight: '0',
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  charCount: {
    textAlign: 'right',
    fontSize: '0.8rem',
    color: '#999',
    marginTop: '4px'
  },
  validationMessage: {
    fontSize: '0.85rem',
    marginTop: '4px',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap'
  },
  saveButton: {
    backgroundColor: '#667eea',
    color: 'white',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: 'none',
    borderRadius: '6px',
    fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'opacity 0.2s'
  },
  cancelButton: {
    backgroundColor: '#eee',
    color: '#333',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: 'none',
    borderRadius: '6px',
    fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'background-color 0.2s'
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '10px 15px',
    borderRadius: '6px',
    marginBottom: '15px',
    border: '1px solid #fcc',
    fontSize: 'clamp(0.85rem, 1.2vw, 0.95rem)'
  }
};

export default NoteEditor;