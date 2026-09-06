// client/src/components/NoteEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, EyeOff, Image, Link, Bold, Italic, Underline, 
  List, ListOrdered, Code, Quote, Heading1, Heading2, Heading3, 
  Upload, X
} from 'lucide-react';

function NoteEditor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({ isValid: false, message: '' });
  const [imageUrl, setImageUrl] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
    } else {
      setTitle('');
      setContent('');
      setPassword('');
      setCurrentPassword('');
      setPasswordValidation({ isValid: false, message: '' });
    }
  }, [note]);

  const validatePassword = (pwd) => {
    if (!pwd || pwd.length < 6) {
      setPasswordValidation({ 
        isValid: false, 
        message: 'Password must be at least 6 characters long' 
      });
      return false;
    }
    
    const hasMinLength = pwd.length >= 6;
    const hasLowercase = /[a-z]/.test(pwd);
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    
    const score = [hasMinLength, hasLowercase, hasUppercase, hasNumber].filter(Boolean).length;
    
    if (score < 3) {
      setPasswordValidation({ 
        isValid: false, 
        message: 'Password should include uppercase, lowercase, and number (min 6 chars)' 
      });
      return false;
    }
    
    setPasswordValidation({ isValid: true, message: '✓ Password meets requirements' });
    return true;
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    validatePassword(newPassword);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        await uploadImage(file);
        return;
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    await uploadImage(file);
    e.target.value = '';
  };

  const uploadImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const imgTag = `<img src="${dataUrl}" alt="Uploaded image" style="max-width: 100%; border-radius: 4px; margin: 8px 0; display: block;" />`;
        insertText(imgTag);
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

  const wrapSelection = (prefix, suffix = '') => {
    const textarea = contentRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    if (start === end) {
      const newContent = content.substring(0, start) + prefix + suffix + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
      }, 0);
      return;
    }
    
    const formatted = prefix + selectedText + suffix;
    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + formatted.length;
    }, 0);
  };

  const handleFormat = (type) => {
    switch(type) {
      case 'bold':
        wrapSelection('**', '**');
        break;
      case 'italic':
        wrapSelection('*', '*');
        break;
      case 'underline':
        wrapSelection('__', '__');
        break;
      case 'code':
        wrapSelection('`', '`');
        break;
      case 'codeBlock':
        wrapSelection('```\n', '\n```');
        break;
      case 'quote':
        wrapSelection('> ', '');
        break;
      case 'h1':
        wrapSelection('# ', '');
        break;
      case 'h2':
        wrapSelection('## ', '');
        break;
      case 'h3':
        wrapSelection('### ', '');
        break;
      case 'ul':
        wrapSelection('- ', '');
        break;
      case 'ol':
        wrapSelection('1. ', '');
        break;
      case 'link': {
        const url = prompt('Enter URL:');
        if (url) {
          wrapSelection(`[`, `](${url})`);
        }
        break;
      }
      default:
        break;
    }
  };

  const handleInsertImage = () => {
    if (imageUrl.trim()) {
      const imgTag = `<img src="${imageUrl}" alt="Note image" style="max-width: 100%; border-radius: 4px; margin: 8px 0; display: block;" />`;
      insertText(imgTag);
      setImageUrl('');
      setShowImageModal(false);
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
        password: password,
        currentPassword: note ? currentPassword : undefined
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

      if (!note) {
        if (!password) {
          setError('PASSWORD_REQUIRED: Encryption key required');
          setLoading(false);
          return;
        }
        if (!validatePassword(password)) {
          setError(passwordValidation.message);
          setLoading(false);
          return;
        }
      }

      if (note) {
        if (!currentPassword) {
          setError('CURRENT_PASSWORD_REQUIRED: Enter current password to make changes');
          setLoading(false);
          return;
        }
        if (password && !validatePassword(password)) {
          setError(passwordValidation.message);
          setLoading(false);
          return;
        }
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
              <button type="button" onClick={() => handleFormat('h1')} style={styles.toolbarButton} title="Heading 1">
                <Heading1 size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('h2')} style={styles.toolbarButton} title="Heading 2">
                <Heading2 size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('h3')} style={styles.toolbarButton} title="Heading 3">
                <Heading3 size={16} />
              </button>
              <div style={styles.toolbarDivider} />
              <button type="button" onClick={() => handleFormat('bold')} style={styles.toolbarButton} title="Bold">
                <Bold size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('italic')} style={styles.toolbarButton} title="Italic">
                <Italic size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('underline')} style={styles.toolbarButton} title="Underline">
                <Underline size={16} />
              </button>
              <div style={styles.toolbarDivider} />
              <button type="button" onClick={() => handleFormat('ul')} style={styles.toolbarButton} title="Bullet List">
                <List size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('ol')} style={styles.toolbarButton} title="Numbered List">
                <ListOrdered size={16} />
              </button>
              <div style={styles.toolbarDivider} />
              <button type="button" onClick={() => handleFormat('code')} style={styles.toolbarButton} title="Inline Code">
                <Code size={16} />
              </button>
              <button type="button" onClick={() => handleFormat('codeBlock')} style={styles.toolbarButton} title="Code Block">
                <Code size={16} style={{ fontSize: '20px' }} />
              </button>
              <button type="button" onClick={() => handleFormat('quote')} style={styles.toolbarButton} title="Quote">
                <Quote size={16} />
              </button>
              <div style={styles.toolbarDivider} />
              <button type="button" onClick={() => handleFormat('link')} style={styles.toolbarButton} title="Link">
                <Link size={16} />
              </button>
              <button type="button" onClick={() => setShowImageModal(true)} style={styles.toolbarButton} title="Insert Image URL">
                <Image size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                style={styles.toolbarButton} 
                title="Upload Image"
              >
                <Upload size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
            
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Write your note content here... (Supports Markdown)
              
Toolbar shortcuts:
• Bold: **text**
• Italic: *text*
• Headers: # ## ###
• Lists: - or 1.
• Images: Paste from clipboard or use upload button"
              style={styles.textarea}
              rows="15"
              disabled={loading}
            />
          </div>

          {!note && (
            <div style={styles.formGroup}>
              <label style={styles.label}>ENCRYPTION_KEY <span style={{ color: '#ff0044' }}>*</span></label>
              <div style={styles.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter encryption key (min 6 characters)"
                  style={styles.passwordInput}
                  disabled={loading}
                  required
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
                  color: passwordValidation.isValid ? '#00ff41' : '#ffa500'
                }}>
                  {passwordValidation.message}
                </div>
              )}
            </div>
          )}

          {note && (
            <div style={styles.formGroup}>
              <label style={styles.label}>CURRENT_PASSWORD <span style={{ color: '#ff0044' }}>*</span></label>
              <div style={styles.passwordInputWrapper}>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password to make changes"
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
              <div style={{ fontSize: '0.7rem', color: '#00ff41', opacity: 0.4, marginTop: '4px' }}>
                [ Current password is required to update this note ]
              </div>
            </div>
          )}

          {note && (
            <div style={styles.formGroup}>
              <label style={styles.label}>NEW_ENCRYPTION_KEY (optional)</label>
              <div style={styles.passwordInputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Set new password (optional)"
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
              {password && passwordValidation.message && (
                <div style={{
                  ...styles.validationMessage,
                  color: passwordValidation.isValid ? '#00ff41' : '#ffa500'
                }}>
                  {passwordValidation.message}
                </div>
              )}
            </div>
          )}

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

      {showImageModal && (
        <div style={styles.imageModalOverlay} onClick={() => setShowImageModal(false)}>
          <div style={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.imageModalHeader}>
              <h3 style={styles.imageModalTitle}>// INSERT_IMAGE</h3>
              <button onClick={() => setShowImageModal(false)} style={styles.imageModalClose}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.imageModalHint}>
              <p>📋 Paste an image from clipboard directly into the editor</p>
              <p>🖼️ Or upload an image using the upload button in the toolbar</p>
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL..."
              style={styles.imageModalInput}
            />
            <div style={styles.imageModalActions}>
              <button onClick={handleInsertImage} style={styles.imageModalSubmit}>
                INSERT_URL
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                style={styles.imageModalUpload}
              >
                <Upload size={16} style={{ marginRight: '6px' }} />
                UPLOAD
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
    minHeight: '200px',
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
    justifyContent: 'center',
    minWidth: '32px',
    height: '32px'
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px'
  },
  imageModal: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #00ff41',
    borderRadius: '4px',
    padding: '30px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 0 40px rgba(0, 255, 65, 0.2)'
  },
  imageModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  imageModalTitle: {
    color: '#00ff41',
    fontSize: '1rem',
    fontFamily: 'monospace',
    margin: 0
  },
  imageModalClose: {
    background: 'none',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    color: '#00ff41',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '2px'
  },
  imageModalHint: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    padding: '12px',
    borderRadius: '2px',
    marginBottom: '16px',
    border: '1px solid rgba(0, 255, 65, 0.1)'
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
    gap: '10px',
    flexWrap: 'wrap'
  },
  imageModalSubmit: {
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    padding: '10px 20px',
    border: '1px solid #00ff41',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    flex: 1,
    minWidth: '80px'
  },
  imageModalUpload: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    color: '#ffa500',
    padding: '10px 20px',
    border: '1px solid #ffa500',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    flex: 1,
    minWidth: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageModalCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#666',
    padding: '10px 20px',
    border: '1px solid #333',
    borderRadius: '2px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    flex: 1,
    minWidth: '80px'
  }
};

export default NoteEditor;