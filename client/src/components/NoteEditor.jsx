import React, { useState, useEffect } from 'react';

function NoteEditor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    }
  }, [note]);

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

      if (isPasswordProtected && !password) {
        setError('Password is required for protected notes');
        setLoading(false);
        return;
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
            />
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
              <label style={styles.label}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password to update"
                style={styles.input}
                disabled={loading}
                required
              />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => {
                  setIsPasswordProtected(e.target.checked);
                  if (!e.target.checked) setPassword('');
                }}
                style={styles.checkbox}
                disabled={loading}
              />
              Password Protect Note
            </label>
            {isPasswordProtected && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={note?.password ? "New password (leave blank to keep current)" : "Enter password"}
                style={{...styles.input, marginTop: '10px'}}
                disabled={loading}
              />
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
    animation: 'slideDown 0.3s ease'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '700px',
    margin: '0 auto'
  },
  title: {
    color: '#333',
    marginBottom: '25px',
    fontSize: '1.8rem'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    color: '#555',
    marginBottom: '8px',
    fontWeight: '500'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    transition: 'border-color 0.2s'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  },
  checkbox: {
    marginRight: '8px'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px'
  },
  saveButton: {
    backgroundColor: '#667eea',
    color: 'white',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1,
    transition: 'opacity 0.2s'
  },
  cancelButton: {
    backgroundColor: '#eee',
    color: '#333',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    flex: 1,
    transition: 'background-color 0.2s'
  },
  error: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: '10px 15px',
    borderRadius: '6px',
    marginBottom: '15px',
    border: '1px solid #fcc'
  }
};

export default NoteEditor;