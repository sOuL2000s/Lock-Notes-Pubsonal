// client/src/components/NoteEditor.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Eye, EyeOff, Image, Link, Bold, Italic, 
  List, ListOrdered, Code, Quote, Heading1, Heading2, Heading3, 
  Upload, X, AlignLeft, AlignCenter, AlignRight, CheckSquare
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
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

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

  // Auto-save draft (optional)
  useEffect(() => {
    const saveDraft = () => {
      if (title || content) {
        localStorage.setItem('note_draft', JSON.stringify({ title, content, timestamp: Date.now() }));
      }
    };
    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(interval);
  }, [title, content]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('note_draft');
    if (draft && !note) {
      try {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.timestamp < 86400000) { // 24 hours
          setTitle(parsed.title || '');
          setContent(parsed.content || '');
        }
      } catch (e) {}
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

  // ---------- Editor Operations ----------
  
  const getSelectionRange = () => {
    if (!editorRef.current) return null;
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    return { start, end };
  };

  const insertText = (text, replaceSelected = false) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let newContent;
    let newCursorPos;
    
    if (replaceSelected && selectedText) {
      newContent = content.substring(0, start) + text + content.substring(end);
      newCursorPos = start + text.length;
    } else {
      newContent = content.substring(0, start) + text + content.substring(end);
      newCursorPos = start + text.length;
    }
    
    setContent(newContent);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 0);
  };

  const wrapSelection = (prefix, suffix = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    // If no selection, insert at cursor position
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

  // Handle Enter key for automatic list continuation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const textarea = editorRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const beforeCursor = content.substring(0, start);
      const afterCursor = content.substring(end);
      
      // Get current line
      const lines = content.split('\n');
      let currentLineIndex = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1;
        if (charCount > start) {
          currentLineIndex = i;
          break;
        }
      }
      const currentLine = lines[currentLineIndex] || '';
      
      // Check for bullet list
      const bulletMatch = currentLine.match(/^(\s*)([-*•])\s+(.+)$/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const bullet = bulletMatch[2];
        const text = bulletMatch[3];
        
        // If line is empty or just whitespace, remove the bullet
        if (!text.trim()) {
          // Remove the bullet line
          const newLines = [...lines];
          newLines.splice(currentLineIndex, 1);
          setContent(newLines.join('\n'));
          setTimeout(() => {
            textarea.focus();
            // Position cursor at the end of previous line or start
            const prevLine = newLines[currentLineIndex - 1] || '';
            const cursorPos = content.split('\n').slice(0, currentLineIndex).join('\n').length + 
                            (currentLineIndex > 0 ? 1 : 0) + prevLine.length;
            textarea.selectionStart = textarea.selectionEnd = cursorPos;
          }, 0);
          return;
        }
        
        // Continue the list
        const newLine = indent + bullet + ' ';
        const newContent = content.substring(0, start) + '\n' + newLine + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + 1 + newLine.length;
        }, 0);
        return;
      }
      
      // Check for numbered list
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        e.preventDefault();
        const indent = numberedMatch[1];
        const num = parseInt(numberedMatch[2]);
        const text = numberedMatch[3];
        
        if (!text.trim()) {
          // Remove the numbered line
          const newLines = [...lines];
          newLines.splice(currentLineIndex, 1);
          // Renumber subsequent lines
          for (let i = currentLineIndex; i < newLines.length; i++) {
            const line = newLines[i];
            const match = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
            if (match) {
              const newNum = parseInt(match[2]) - 1;
              newLines[i] = match[1] + newNum + '. ' + match[3];
            }
          }
          setContent(newLines.join('\n'));
          setTimeout(() => {
            textarea.focus();
            const prevLine = newLines[currentLineIndex - 1] || '';
            const cursorPos = content.split('\n').slice(0, currentLineIndex).join('\n').length + 
                            (currentLineIndex > 0 ? 1 : 0) + prevLine.length;
            textarea.selectionStart = textarea.selectionEnd = cursorPos;
          }, 0);
          return;
        }
        
        const nextNum = num + 1;
        const newLine = indent + nextNum + '. ';
        const newContent = content.substring(0, start) + '\n' + newLine + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + 1 + newLine.length;
        }, 0);
        return;
      }
      
      // Check for task list (checkbox)
      const taskMatch = currentLine.match(/^(\s*)- \[([ x])\]\s+(.+)$/);
      if (taskMatch) {
        e.preventDefault();
        const indent = taskMatch[1];
        const checked = taskMatch[2];
        const text = taskMatch[3];
        
        if (!text.trim()) {
          const newLines = [...lines];
          newLines.splice(currentLineIndex, 1);
          setContent(newLines.join('\n'));
          setTimeout(() => {
            textarea.focus();
            const prevLine = newLines[currentLineIndex - 1] || '';
            const cursorPos = content.split('\n').slice(0, currentLineIndex).join('\n').length + 
                            (currentLineIndex > 0 ? 1 : 0) + prevLine.length;
            textarea.selectionStart = textarea.selectionEnd = cursorPos;
          }, 0);
          return;
        }
        
        const newLine = indent + '- [ ] ';
        const newContent = content.substring(0, start) + '\n' + newLine + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + 1 + newLine.length;
        }, 0);
        return;
      }
    }
    
    // Tab key for indentation
    if (e.key === 'Tab') {
      const textarea = editorRef.current;
      if (!textarea) return;
      
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      if (start === end) {
        // Insert 2 spaces at cursor
        insertText('  ');
      } else {
        // Indent selected lines
        const lines = content.split('\n');
        let charCount = 0;
        let startLine = 0;
        let endLine = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const lineLen = lines[i].length + 1;
          if (charCount + lineLen > start && startLine === 0) startLine = i;
          if (charCount + lineLen >= end) { endLine = i; break; }
          charCount += lineLen;
        }
        
        const newLines = [...lines];
        for (let i = startLine; i <= endLine; i++) {
          newLines[i] = '  ' + newLines[i];
        }
        setContent(newLines.join('\n'));
        setTimeout(() => {
          textarea.focus();
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = end + (endLine - startLine + 1) * 2;
        }, 0);
      }
    }
  };

  const handleFormat = (type) => {
    switch(type) {
      case 'bold':
        wrapSelection('**', '**');
        break;
      case 'italic':
        wrapSelection('*', '*');
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
        // Find the current line number for proper numbering
        const textarea = editorRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const beforeCursor = content.substring(0, start);
          const lineCount = beforeCursor.split('\n').length;
          wrapSelection(`${lineCount}. `, '');
        } else {
          wrapSelection('1. ', '');
        }
        break;
      case 'task':
        wrapSelection('- [ ] ', '');
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

  const handleInsertImage = () => {
    if (imageUrl.trim()) {
      const imgTag = `<img src="${imageUrl}" alt="Note image" style="max-width: 100%; border-radius: 4px; margin: 8px 0; display: block;" />`;
      insertText(imgTag);
      setImageUrl('');
      setShowImageModal(false);
    }
  };

  // ---------- Render Markdown to HTML ----------
  const renderMarkdown = (text) => {
    if (!text) return null;
    
    // Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Bold and Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    
    // Task lists
    html = html.replace(/^- \[x\] (.+)$/gm, '<div class="task-item checked"><input type="checkbox" checked disabled><span>$1</span></div>');
    html = html.replace(/^- \[ \] (.+)$/gm, '<div class="task-item"><input type="checkbox" disabled><span>$1</span></div>');
    
    // Bullet lists
    html = html.replace(/^[-*•] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      // Only wrap if it's numbered list items
      return `<ol>${match}</ol>`;
    });
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Images
    html = html.replace(/<img src="([^"]+)"[^>]*>/g, (match, src) => {
      return `<img src="${src}" alt="Note image" style="max-width:100%;border-radius:4px;margin:8px 0;display:block;" />`;
    });
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    
    return html;
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
      
      // Clear draft on success
      localStorage.removeItem('note_draft');
    } catch (err) {
      setError(err.message || 'SAVE_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {note ? '// EDIT_NOTE' : '// CREATE_NOTE'}
          </h2>
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            style={styles.previewToggle}
          >
            {isPreviewMode ? '✏️ EDIT' : '👁️ PREVIEW'}
          </button>
        </div>
        
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
            {!isPreviewMode ? (
              <>
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
                  <div style={styles.toolbarDivider} />
                  <button type="button" onClick={() => handleFormat('ul')} style={styles.toolbarButton} title="Bullet List">
                    <List size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('ol')} style={styles.toolbarButton} title="Numbered List">
                    <ListOrdered size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('task')} style={styles.toolbarButton} title="Task List">
                    <CheckSquare size={16} />
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
                  ref={editorRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Write your note here..."
                  style={styles.textarea}
                  rows="15"
                  disabled={loading}
                />
                
                <div style={styles.editorHints}>
                  <span>• Use **bold** and *italic*</span>
                  <span>• Lists auto-continue on Enter</span>
                  <span>• Paste images directly</span>
                </div>
              </>
            ) : (
              <div 
                style={styles.preview}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) || '<em>Empty note</em>' }}
              />
            )}
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
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px'
  },
  title: {
    color: '#00ff41',
    fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
    wordBreak: 'break-word',
    fontFamily: 'monospace',
    letterSpacing: '1px'
  },
  previewToggle: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '8px 16px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    transition: 'all 0.3s ease'
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
  preview: {
    padding: '10px 14px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    minHeight: '200px',
    lineHeight: '1.8',
    fontFamily: 'monospace',
    overflow: 'auto',
    '& h1': { fontSize: '2rem', margin: '0.5rem 0', borderBottom: '1px solid rgba(0,255,65,0.1)' },
    '& h2': { fontSize: '1.5rem', margin: '0.5rem 0' },
    '& h3': { fontSize: '1.2rem', margin: '0.5rem 0' },
    '& ul, & ol': { paddingLeft: '24px', margin: '8px 0' },
    '& li': { marginBottom: '4px' },
    '& blockquote': { borderLeft: '3px solid #00ff41', paddingLeft: '16px', opacity: 0.7 },
    '& pre': { backgroundColor: 'rgba(0,0,0,0.5)', padding: '12px 16px', borderRadius: '4px', overflow: 'auto' },
    '& code': { backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '2px' },
    '& a': { color: '#00ff41', textDecoration: 'underline' },
    '& .task-item': { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
    '& .task-item input[type="checkbox"]': { 
      accentColor: '#00ff41',
      width: '16px',
      height: '16px',
      cursor: 'default'
    },
    '& .task-item.checked span': { opacity: 0.5, textDecoration: 'line-through' }
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
    height: '32px',
    '&:hover': {
      backgroundColor: 'rgba(0, 255, 65, 0.1)',
      borderColor: '#00ff41'
    }
  },
  toolbarDivider: {
    width: '1px',
    background: 'rgba(0, 255, 65, 0.1)',
    margin: '0 4px'
  },
  editorHints: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
    fontSize: '0.7rem',
    color: '#00ff41',
    opacity: 0.3,
    fontFamily: 'monospace',
    flexWrap: 'wrap'
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
    border: '1px solid rgba(0, 255, 65, 0.1)',
    color: '#00ff41',
    fontSize: '0.8rem',
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

// Add style injection for preview
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .note-preview h1 { font-size: 2rem; margin: 0.5rem 0; border-bottom: 1px solid rgba(0,255,65,0.1); }
  .note-preview h2 { font-size: 1.5rem; margin: 0.5rem 0; }
  .note-preview h3 { font-size: 1.2rem; margin: 0.5rem 0; }
  .note-preview ul, .note-preview ol { padding-left: 24px; margin: 8px 0; }
  .note-preview li { margin-bottom: 4px; }
  .note-preview blockquote { border-left: 3px solid #00ff41; padding-left: 16px; opacity: 0.7; }
  .note-preview pre { background-color: rgba(0,0,0,0.5); padding: 12px 16px; border-radius: 4px; overflow: auto; }
  .note-preview code { background-color: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 2px; }
  .note-preview a { color: #00ff41; text-decoration: underline; }
  .note-preview .task-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .note-preview .task-item input[type="checkbox"] { accent-color: #00ff41; width: 16px; height: 16px; cursor: default; }
  .note-preview .task-item.checked span { opacity: 0.5; text-decoration: line-through; }
`;
document.head.appendChild(styleSheet);

export default NoteEditor;