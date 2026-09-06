// client/src/components/NoteEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Image, Link, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

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
  const [imageUrl, setImageUrl] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const contentRef = useRef(null);

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
      setPasswordValidation({ isValid: false, message: 'PASSWORD_REQUIRED' });
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
        message: 'WEAK_ENCRYPTION: Minimum 8 chars, include uppercase, lowercase, number/special' 
      });
      return false;
    }
    
    setPasswordValidation({ isValid: true, message: 'STRONG_ENCRYPTION ✓' });
    return true;
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (isPasswordProtected) {
      validatePassword(newPassword);
    }
  };

  const handleInsertImage = () => {
    if (imageUrl) {
      const imgTag = `<img src="${imageUrl}" alt="Note image" style="max-width: 100%; border-radius: 4px; margin: 8px 0;" />`;
      insertText(imgTag);
      setImageUrl('');
      setShowImageModal(false);
    }
  };

  const insertText = (text) => {
    const textarea = contentRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + text + content.substring(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  const handleFormat = (format) => {
    const textarea = contentRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formatted = '';
    switch(format) {
      case 'bold':
        formatted = `**${selectedText}**`;
        break;
      case 'italic':
        formatted = `*${selectedText}*`;
        break;
      case 'underline':
        formatted = `__${selectedText}__`;
        break;
      default:
        return;
    }
    
    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + formatted.length;
    }, 0);
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
        setError('TITLE_REQUIRED');
        setLoading(false);
        return;
      }

      if (!noteData.content) {
        setError('CONTENT_REQUIRED');
        setLoading(false);
        return;
      }

      if (isPasswordProtected) {
        if (!password) {
          setError('PASSWORD_REQUIRED');
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
        setError('CURRENT_PASSWORD_REQUIRED');
        setLoading(false);
        return;
      }

      if (note) {
        await onSave(note._id, noteData);
      } else {
        await onSave(noteData);
      }
    } catch (err) {
      setError(err.message || 'SAVE_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>
          {note ? '// EDIT_NOTE' : '// CREATE_NOTE'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title..."
              style={styles.input}
              disabled={loading}
              maxLength={100}
            />
            <div style={styles.charCount}>{title.length}/100</div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>CONTENT</label>
            <div style={styles.toolbar}>
              <button type="button" onClick={() => handleFormat('bold')} style={styles.toolbarButton}>
                <Bold size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('italic')} style={styles.toolbarButton}>
                <Italic size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('underline')} style={styles.toolbarButton}>
                <Underline size={16} />
              </button>
              <div style={styles.toolbarDivider} />
              <button type="button" onClick={() => setShowImageModal(true)} style={styles.toolbarButton}>
                <Image size={16} />
              </button>
              <button type="button" onClick={() => insertText('\n[Link: ]')} style={styles.toolbarButton}>
                <Link size={16} />
              </button>
            </div>
            
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note content here... (Supports Markdown)"
              style={styles.textarea}
              rows="12"
              disabled={loading}
            />
          </div>

          {note?.password && (
            <div style={styles.formGroup}>
              <label style={styles.label}>CURRENT_PASSWORD</label>
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
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
              ENABLE_ENCRYPTION
            </label>
            
            {isPasswordProtected && (
              <>
                <div style={styles.passwordInputWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder={note?.password ? "New password (leave blank to keep current)" : "Enter encryption key"}
                    style={styles.passwordInput}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordValidation.message && (
                  <div style={{
                    ...styles.validationMessage,
                    color: passwordValidation.isValid ? '#00ff41' : '#ff0044'
                  }}>
                    {passwordValidation.message}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.saveButton}
              disabled={loading}
            >
              {loading ? 'PROCESSING...' : (note ? 'UPDATE_NOTE' : 'CREATE_NOTE')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelButton}
              disabled={loading}
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div style={styles.imageModalOverlay} onClick={() => setShowImageModal(false)}>
          <div style={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.imageModalTitle}>// INSERT_IMAGE</h3>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL..."
              style={styles.imageModalInput}
            />
            <div style={styles.imageModalActions}>
              <button onClick={handleInsertImage} style={styles.imageModalSubmit}>
                INSERT
              </button>
              <button onClick={() => setShowImageModal(false)} style={styles.imageModalCancel}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
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
    backgroundColor: '#0a0a0a',
    border: '1px solid #00ff41',
    borderRadius: '4px',
    padding: 'clamp(20px, 4vw, 30px)',
    boxShadow: '0 0 40px rgba(0, 255, 65, 0.1), inset 0 0 40px rgba(0, 255, 65, 0.02)',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  title: {
    color: '#00ff41',
    marginBottom: '25px',
    fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
    wordBreak: 'break-word',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    color: '#00ff41',
    opacity: 0.6,
    marginBottom: '8px',
    fontWeight: '700',
    fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    color: '#00ff41',
    opacity: 0.6,
    fontWeight: '700',
    fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
    cursor: 'pointer',
    gap: '10px',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    fontFamily: 'monospace'
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'monospace',
    transition: 'all 0.3s ease',
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    minHeight: '150px',
    lineHeight: '1.8'
  },
  toolbar: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    marginBottom: '8px',
    border: '1px solid rgba(0, 255, 65, 0.1)',
    borderRadius: '2px',
    background: 'rgba(0, 0, 0, 0.3)',
    flexWrap: 'wrap'
  },
  toolbarButton: {
    background: 'none',
    border: '1px solid rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    padding: '6px 10px',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolbarDivider: {
    width: '1px',
    background: 'rgba(0, 255, 65, 0.1)',
    margin: '0 4px'
  },
  passwordInputWrapper: {
    position: 'relative',
    width: '100%'
  },
  passwordInput: {
    width: '100%',
    padding: '10px 14px',
    paddingRight: '45px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    fontFamily: 'monospace'
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '5px',
    color: '#00ff41',
    opacity: 0.6,
  },
  checkbox: {
    marginRight: '0',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#00ff41'
  },
  charCount: {
    textAlign: 'right',
    fontSize: '0.7rem',
    color: '#00ff41',
    opacity: 0.4,
    marginTop: '4px',
    fontFamily: 'monospace'
  },
  validationMessage: {
    fontSize: '0.75rem',
    marginTop: '4px',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap'
  },
  saveButton: {
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#666',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: '1px solid #333',
    borderRadius: '2px',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'all 0.3s ease',
    fontFamily: 'monospace'
  },
  error: {
    backgroundColor: 'rgba(255, 0, 68, 0.1)',
    color: '#ff0044',
    padding: '10px 15px',
    borderRadius: '2px',
    marginBottom: '15px',
    border: '1px solid #ff0044',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontFamily: 'monospace'
  },
  imageModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },
  imageModal: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #00ff41',
    borderRadius: '4px',
    padding: '30px',
    maxWidth: '400px',
    width: '90%'
  },
  imageModalTitle: {
    color: '#00ff41',
    fontSize: '1rem',
    marginBottom: '16px',
    fontFamily: 'monospace'
  },
  imageModalInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    fontFamily: 'monospace',
    marginBottom: '16px',
    outline: 'none'
  },
  imageModalActions: {
    display: 'flex',
    gap: '10px'
  },
  imageModalSubmit: {
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    padding: '10px 20px',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    flex: 1
  },
  imageModalCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#666',
    padding: '10px 20px',
    border: '1px solid #333',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    flex: 1
  }
};

export default NoteEditor;