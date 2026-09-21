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

  useEffect(() => {
    if (preVerifiedPassword) handleAutoVerify(preVerifiedPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preVerifiedPassword]);

  useEffect(() => {
    if (!preVerifiedPassword) {
      setIsPasswordVerified(false);
      setViewPassword('');
      setAttempts(0);
    }
  }, [note?._id, preVerifiedPassword]);

  const handleAutoVerify = async (password) => {
    if (!note?._id) return;
    try {
      await api.verifyPassword(note._id, password);
      setIsPasswordVerified(true);
      setViewPassword(password);
      setAttempts(0);
    } catch (error) {
      setIsPasswordVerified(false);
      setViewPassword('');
      setShowPasswordModal(true);
    }
  };

  const verifyPassword = async (password) => {
    try {
      await api.verifyPassword(note._id, password);
      return true;
    } catch (error) {
      if (error.message === 'INVALID_PASSWORD') throw new Error('Invalid password');
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
      if (passwordAction === 'edit') onEdit(note);
      else if (passwordAction === 'delete') await onDelete(note._id, password);
      return true;
    } catch (error) {
      setAttempts((prev) => prev + 1);
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
      onEdit(note, viewPassword);
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

  // ----- Markdown rendering -----

  const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ----- Syntax highlighting (theme-matched, no external library) -----

  // Token colors are set via CSS classes (.tok-key, .tok-str, etc.)
  const highlightGeneric = (code) => {
    // Very light generic pass: strings, numbers, comments
    return escapeHtml(code)
      .replace(/(\/\/[^\n]*|#[^\n]*|--[^\n]*)/g, '<span class="tok-com">$1</span>')
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="tok-str">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  };

  const highlightJS = (code) => {
    let out = escapeHtml(code);
    // Block comments
    out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => `<span class="tok-com">${m}</span>`);
    // Line comments
    out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => `${p1}<span class="tok-com">${m.slice(p1.length)}</span>`);
    // Strings (single, double, template)
    out = out.replace(/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
      (m) => `<span class="tok-str">${m}</span>`);
    // Keywords
    out = out.replace(
      /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|try|catch|finally|throw|typeof|instanceof|in|of|import|export|from|as|default|async|await|yield|delete|void|null|undefined|true|false|interface|type|enum|implements|public|private|protected|readonly|static|namespace|declare|abstract)\b/g,
      '<span class="tok-key">$1</span>'
    );
    // Numbers
    out = out.replace(/\b(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/gi, '<span class="tok-num">$1</span>');
    // Function calls
    out = out.replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, '<span class="tok-fn">$1</span>');
    return out;
  };

  const highlightPython = (code) => {
    let out = escapeHtml(code);
    // Comments
    out = out.replace(/(^|\s)#[^\n]*/g, (m, p1) => `${p1}<span class="tok-com">${m.slice(p1.length)}</span>`);
    // Triple-quoted strings first
    out = out.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '<span class="tok-str">$1</span>');
    // Single/double quoted
    out = out.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="tok-str">$1</span>');
    // Keywords
    out = out.replace(
      /\b(def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|with|try|except|finally|raise|yield|lambda|global|nonlocal|assert|del|in|is|not|and|or|None|True|False|async|await|self)\b/g,
      '<span class="tok-key">$1</span>'
    );
    // Numbers
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    // Function defs
    out = out.replace(/\b([A-Za-z_]\w*)(?=\s*\()/g, '<span class="tok-fn">$1</span>');
    return out;
  };

  const highlightHTML = (code) => {
    let out = escapeHtml(code);
    // Comments
    out = out.replace(/&lt;!--[\s\S]*?--&gt;/g, '<span class="tok-com">$&</span>');
    // Tags
    out = out.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1<span class="tok-tag">$2</span>');
    // Attributes
    out = out.replace(/\s([a-zA-Z-]+)=/g, ' <span class="tok-attr">$1</span>=');
    // Strings inside attributes
    out = out.replace(/=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '=<span class="tok-str">$1</span>');
    return out;
  };

  const highlightCSS = (code) => {
    let out = escapeHtml(code);
    out = out.replace(/\/\*[\s\S]*?\*\//g, '<span class="tok-com">$&</span>');
    // Selectors at line start until { 
    out = out.replace(/(^|\n)([^{}\n]+)(?=\s*\{)/g, (m, p1, p2) =>
      `${p1}<span class="tok-sel">${p2}</span>`);
    // Properties
    out = out.replace(/([a-zA-Z-]+)(\s*:\s*)/g, '<span class="tok-prop">$1</span>$2');
    // Values with colors/numbers
    out = out.replace(/:\s*([^;{}\n]+)/g, (m, v) => `: <span class="tok-val">${v}</span>`);
    out = out.replace(/#[0-9a-fA-F]{3,8}\b/g, '<span class="tok-num">$&</span>');
    out = out.replace(/\b(\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%|s|ms)?)\b/g, '<span class="tok-num">$1</span>');
    return out;
  };

  const highlightJSON = (code) => {
    let out = escapeHtml(code);
    // Keys
    out = out.replace(/"([^"\\]|\\.)*"(\s*:)/g, '<span class="tok-prop">$&</span>');
    // Remaining strings
    out = out.replace(/(:\s*)("(?:[^"\\]|\\.)*")/g, '$1<span class="tok-str">$2</span>');
    // Numbers, booleans, null
    out = out.replace(/\b(true|false|null)\b/g, '<span class="tok-key">$1</span>');
    out = out.replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="tok-num">$2</span>');
    return out;
  };

  const highlightBash = (code) => {
    let out = escapeHtml(code);
    out = out.replace(/(^|\s)#[^\n]*/g, (m, p1) => `${p1}<span class="tok-com">${m.slice(p1.length)}</span>`);
    out = out.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="tok-str">$1</span>');
    out = out.replace(
      /\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|find|chmod|chown|sudo|apt|npm|yarn|pnpm|node|git|docker|kubectl|curl|wget|export|source|if|then|else|fi|for|do|done|while|function|return)\b/g,
      '<span class="tok-key">$1</span>'
    );
    out = out.replace(/\$\w+|\$\{[^}]+\}/g, '<span class="tok-var">$&</span>');
    return out;
  };

  const highlightCode = (code, lang) => {
    const l = (lang || '').toLowerCase();
    if (['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'node'].includes(l)) return highlightJS(code);
    if (['py', 'python'].includes(l)) return highlightPython(code);
    if (['html', 'xml', 'svg', 'vue'].includes(l)) return highlightHTML(code);
    if (['css', 'scss', 'sass', 'less'].includes(l)) return highlightCSS(code);
    if (['json', 'jsonc'].includes(l)) return highlightJSON(code);
    if (['sh', 'bash', 'shell', 'zsh', 'console'].includes(l)) return highlightBash(code);
    return highlightGeneric(code);
  };

  const renderMarkdown = (text) => {
    if (!text) return '';

    const placeholders = [];
    const stash = (html) => {
      const key = `\u0000PH${placeholders.length}\u0000`;
      placeholders.push(html);
      return key;
    };

    let src = text;

    src = src.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const trimmed = code.replace(/\n$/, '');
      const html = highlightCode(trimmed, lang);
      const cls = lang ? ` class="language-${lang.toLowerCase()}"` : '';
      return stash(`<pre><code${cls}>${html}</code></pre>`);
    });

    src = src.replace(/`([^`\n]+)`/g, (_, code) =>
      stash(`<code>${escapeHtml(code)}</code>`)
    );

    src = src.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = /^(https?:|data:image\/|\/)/i.test(url.trim()) ? url.trim() : '';
      if (!safe) return '';
      return stash(
        `<img src="${safe}" alt="${escapeHtml(alt || 'image')}" style="max-width:100%;border-radius:4px;margin:8px 0;display:block;" />`
      );
    });

    src = src.replace(/<img\b[^>]*>/gi, (tag) => {
      const srcMatch = tag.match(/src\s*=\s*"([^"]*)"/i) || tag.match(/src\s*=\s*'([^']*)'/i);
      if (!srcMatch) return '';
      const url = srcMatch[1];
      const safe = /^(https?:|data:image\/|\/)/i.test(url.trim()) ? url.trim() : '';
      if (!safe) return '';
      return stash(
        `<img src="${safe}" alt="Note image" style="max-width:100%;border-radius:4px;margin:8px 0;display:block;" />`
      );
    });

    src = escapeHtml(src);

    const lines = src.split('\n');
    const out = [];
    let i = 0;
    let inList = null;
    let listBuf = [];

    const flushList = () => {
      if (inList) {
        out.push(`<${inList}>${listBuf.join('')}</${inList}>`);
        listBuf = [];
        inList = null;
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      const taskMatch = line.match(/^([-*•])\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        flushList();
        const checked = taskMatch[2].toLowerCase() === 'x';
        out.push(
          `<div class="task-item${checked ? ' checked' : ''}">` +
          `<input type="checkbox" ${checked ? 'checked' : ''} disabled class="task-checkbox-viewer" />` +
          `<span>${taskMatch[3]}</span>` +
          `</div>`
        );
        i++;
        continue;
      }

      const bulletMatch = line.match(/^([-*•])\s+(.*)$/);
      if (bulletMatch) {
        if (inList !== 'ul') { flushList(); inList = 'ul'; }
        listBuf.push(`<li>${bulletMatch[2]}</li>`);
        i++;
        continue;
      }

      const numMatch = line.match(/^\d+\.\s+(.*)$/);
      if (numMatch) {
        if (inList !== 'ol') { flushList(); inList = 'ol'; }
        listBuf.push(`<li>${numMatch[1]}</li>`);
        i++;
        continue;
      }

      flushList();

      if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
        out.push('<hr />');
        i++;
        continue;
      }

      if (
        line.includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
      ) {
        const parseRow = (row) =>
          row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
        const headers = parseRow(line);
        const aligns = parseRow(lines[i + 1]).map((c) => {
          const left = c.startsWith(':');
          const right = c.endsWith(':');
          if (left && right) return 'center';
          if (right) return 'right';
          if (left) return 'left';
          return 'left';
        });
        const bodyRows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') {
          bodyRows.push(parseRow(lines[j]));
          j++;
        }
        const thead = '<thead><tr>' + headers.map((h, k) =>
          `<th style="text-align:${aligns[k] || 'left'}">${h}</th>`).join('') + '</tr></thead>';
        const tbody = '<tbody>' + bodyRows.map((row) =>
          '<tr>' + row.map((c, k) => `<td style="text-align:${aligns[k] || 'left'}">${c}</td>`).join('') + '</tr>'
        ).join('') + '</tbody>';
        out.push(`<table class="md-table">${thead}${tbody}</table>`);
        i = j;
        continue;
      }

      if (/^### (.*)$/.test(line)) { out.push(line.replace(/^### (.*)$/, '<h3>$1</h3>')); i++; continue; }
      if (/^## (.*)$/.test(line)) { out.push(line.replace(/^## (.*)$/, '<h2>$1</h2>')); i++; continue; }
      if (/^# (.*)$/.test(line)) { out.push(line.replace(/^# (.*)$/, '<h1>$1</h1>')); i++; continue; }
      if (/^&gt;\s?(.*)$/.test(line)) { out.push(line.replace(/^&gt;\s?(.*)$/, '<blockquote>$1</blockquote>')); i++; continue; }

      out.push(line);
      i++;
    }
    flushList();

    src = out.join('\u0000BLK\u0000');

    src = src.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    src = src.replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>');
    src = src.replace(/__(.+?)__/g, '<u>$1</u>');

    src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safe = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : '#';
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    src = src.replace(/\u0000PH(\d+)\u0000/g, (_, idx) => placeholders[Number(idx)] || '');
    src = src.replace(/\n/g, '<br />');
    src = src.replace(/\u0000BLK\u0000/g, '\n');

    return src;
  };

  // ----- Locked state -----

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
            <p style={styles.lockDescription}>[ DECRYPTION_KEY_REQUIRED ]</p>
            <button onClick={handleViewRequest} style={styles.unlockButton}>
              <Unlock size={16} style={{ marginRight: '8px' }} />
              DECRYPT_NOTE
            </button>
          </div>
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => { setShowPasswordModal(false); setPasswordAction('view'); }}
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
              <span style={styles.date}>UPDATED: {new Date(note.updatedAt).toLocaleDateString()}</span>
            )}
            <span style={styles.protected}>🔒 ENCRYPTED</span>
          </div>

          <div
            style={styles.content}
            className="note-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) || '<em>Empty note</em>' }}
          />

          <div style={styles.actions}>
            <button onClick={handleEditClick} style={styles.editButton} disabled={loading}>
              <Edit size={16} style={{ marginRight: '8px' }} />
              EDIT_NOTE
            </button>
            <button onClick={handleDeleteClick} style={styles.deleteButton} disabled={loading}>
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
        onClose={() => { setShowPasswordModal(false); setPasswordAction('view'); }}
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

const styles = {
  container: { padding: '20px 0', animation: 'fadeIn 0.3s ease', width: '100%' },
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
    opacity: 0.9,
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    fontFamily: 'monospace'
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
  lockIcon: { color: '#00ff41', marginBottom: '16px', opacity: 0.6 },
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