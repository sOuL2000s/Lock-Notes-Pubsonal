// client/src/components/NoteEditor.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Eye, EyeOff, Image, Link, Bold, Italic,
  List, ListOrdered, Code, Quote, Heading1, Heading2, Heading3,
  Upload, X, CheckSquare, Eye as EyeIcon, Pencil, Save, AlertTriangle,
} from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';
import { useDebouncedAutosave } from '../hooks/useDebouncedAutosave';
import { api } from '../services/api';

// ----- Line-level helpers (identical to previous version) -----

const getLineBounds = (text, index) => {
  const clamped = Math.max(0, Math.min(index, text.length));
  const lineStart = text.lastIndexOf('\n', clamped - 1) + 1;
  const nextNl = text.indexOf('\n', clamped);
  const lineEnd = nextNl === -1 ? text.length : nextNl;
  return { lineStart, lineEnd, lineText: text.slice(lineStart, lineEnd) };
};

const getSelectionLineRange = (text, selStart, selEnd) => {
  const first = getLineBounds(text, selStart);
  const last = getLineBounds(text, selEnd);
  return { start: first.lineStart, end: last.lineEnd };
};

const RE_H = /^(#{1,3})\s+/;
const RE_QUOTE = /^>\s+/;
const RE_BULLET = /^[-*•]\s+/;
const RE_NUMBER = /^(\d+)\.\s+/;
const RE_TASK = /^[-*•]\s+\[([ xX])\]\s+/;
const RE_CODE_FENCE = /^```/;

const detectLineKind = (line) => {
  if (RE_CODE_FENCE.test(line)) return { type: 'fence' };
  const task = line.match(RE_TASK);
  if (task) return { type: 'task', checked: task[1].toLowerCase() === 'x', indent: line.match(/^(\s*)/)[1] };
  const num = line.match(RE_NUMBER);
  if (num) return { type: 'number', num: parseInt(num[1], 10), indent: line.match(/^(\s*)/)[1] };
  const bul = line.match(RE_BULLET);
  if (bul) return { type: 'bullet', indent: line.match(/^(\s*)/)[1] };
  const h = line.match(RE_H);
  if (h) return { type: 'heading', level: h[1].length };
  if (RE_QUOTE.test(line)) return { type: 'quote' };
  return { type: 'plain' };
};

const stripPrefix = (line) => {
  return line
    .replace(RE_TASK, '')
    .replace(RE_BULLET, '')
    .replace(RE_NUMBER, '')
    .replace(RE_H, '')
    .replace(RE_QUOTE, '');
};

// Relative time formatter for the autosave indicator
function relativeTime(ts) {
  if (!ts) return '';
  const secs = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

function NoteEditor({ note, preVerifiedPassword = '', onSave, onCancel }) {
  const isEditMode = !!note;

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

  // Server-conflict state
  const [conflictBanner, setConflictBanner] = useState(null);

  // Version we last confirmed with the server (used for optimistic concurrency)
  const [expectedVersion, setExpectedVersion] = useState(
    note && typeof note.version === 'number' ? note.version : null
  );

  // Autosave ticker (so "Saved 5s ago" updates live)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const historyRef = useRef({ stack: [], index: -1, applying: false });
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // ----- Lifecycle -----

  useEffect(() => {
    setIsPreviewMode(false);
    setConflictBanner(null);
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setPassword('');
      setCurrentPassword(preVerifiedPassword || '');
      setPasswordValidation({ isValid: false, message: '' });
      setExpectedVersion(typeof note.version === 'number' ? note.version : null);
    } else {
      setTitle('');
      setContent('');
      setPassword('');
      setCurrentPassword('');
      setPasswordValidation({ isValid: false, message: '' });
      setExpectedVersion(null);
      localStorage.removeItem('note_draft');
    }
    historyRef.current = { stack: [], index: -1, applying: false };
  }, [note, preVerifiedPassword]);

  // Draft autosave for new notes (localStorage only)
  useEffect(() => {
    if (isEditMode) return;
    const saveDraft = () => {
      if (title || content) {
        localStorage.setItem('note_draft', JSON.stringify({ title, content, timestamp: Date.now() }));
      }
    };
    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(saveDraft);
  }, [title, content, isEditMode]);

  useEffect(() => {
    const draft = localStorage.getItem('note_draft');
    if (draft && !isEditMode) {
      try {
        const parsed = JSON.parse(draft);
        if (Date.now() - parsed.timestamp < 86400000) {
          setTitle(parsed.title || '');
          setContent(parsed.content || '');
        }
      } catch (e) { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- History (for programmatic edits) -----

  const pushHistory = (value) => {
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(value);
    h.index = h.stack.length - 1;
    if (h.stack.length > 100) {
      h.stack.shift();
      h.index--;
    }
  };

  const applyContent = useCallback((nextContent, selStart, selEnd) => {
    setContent((prev) => {
      if (prev !== nextContent) pushHistory(prev);
      return nextContent;
    });
    if (typeof selStart === 'number') {
      requestAnimationFrame(() => {
        const ta = editorRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = selStart;
          ta.selectionEnd = typeof selEnd === 'number' ? selEnd : selStart;
        }
      });
    }
  }, []);

  // ----- Password validation -----

  const validatePassword = (pwd) => {
    if (!pwd || pwd.length < 6) {
      setPasswordValidation({ isValid: false, message: 'Password must be at least 6 characters long' });
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

  // ----- Core text manipulation -----

  const insertText = (text) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + text + content.slice(end);
    applyContent(next, start + text.length);
  };

  const transformLines = (transformFn) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const { start: rangeStart, end: rangeEnd } = getSelectionLineRange(content, start, end);
    const block = content.slice(rangeStart, rangeEnd);
    const lines = block.split('\n');
    const nextLines = lines.map((line, i) => transformFn(line, i, lines));
    const nextBlock = nextLines.join('\n');
    const next = content.slice(0, rangeStart) + nextBlock + content.slice(rangeEnd);
    const delta = nextBlock.length - block.length;
    applyContent(next, start + (start >= rangeStart ? delta : 0), end + delta);
  };

  const setLineKind = (kind, opts = {}) => {
    transformLines((line) => {
      const raw = stripPrefix(line).replace(/\s+$/, '');
      const stripped = line.replace(/^\s+/, '');
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      const current = detectLineKind(stripped);
      const alreadyThis =
        (kind === 'bullet' && current.type === 'bullet') ||
        (kind === 'number' && current.type === 'number') ||
        (kind === 'task' && current.type === 'task') ||
        (kind === 'quote' && current.type === 'quote') ||
        (kind === 'heading1' && current.type === 'heading' && current.level === 1) ||
        (kind === 'heading2' && current.type === 'heading' && current.level === 2) ||
        (kind === 'heading3' && current.type === 'heading' && current.level === 3) ||
        (kind === 'code' && current.type === 'fence') ||
        (kind === 'plain' && current.type === 'plain');

      if (alreadyThis && kind !== 'plain') return indent + raw;

      switch (kind) {
        case 'plain': return indent + raw;
        case 'bullet': return indent + '- ' + raw;
        case 'number': return indent + (opts.n || 1) + '. ' + raw;
        case 'task': return indent + '- [ ] ' + raw;
        case 'quote': return indent + '> ' + raw;
        case 'heading1': return indent + '# ' + raw;
        case 'heading2': return indent + '## ' + raw;
        case 'heading3': return indent + '### ' + raw;
        case 'code': return indent + '```' + raw;
        default: return line;
      }
    });
  };

  const wrapSelection = (prefix, suffix = prefix) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);

    if (before.endsWith(prefix) && after.startsWith(suffix) && selected.length >= 0) {
      const next =
        before.slice(0, before.length - prefix.length) +
        selected +
        after.slice(suffix.length);
      const newStart = start - prefix.length;
      applyContent(next, newStart, newStart + selected.length);
      return;
    }

    if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
      const inner = selected.slice(prefix.length, selected.length - suffix.length);
      const next = before + inner + after;
      applyContent(next, start, start + inner.length);
      return;
    }

    if (start === end) {
      const next = before + prefix + suffix + after;
      applyContent(next, start + prefix.length);
    } else {
      const wrapped = prefix + selected + suffix;
      const next = before + wrapped + after;
      applyContent(next, start, start + wrapped.length);
    }
  };

  // ----- Toolbar actions -----

  const handleFormat = (type) => {
    switch (type) {
      case 'bold': wrapSelection('**'); break;
      case 'italic': wrapSelection('*'); break;
      case 'inlineCode': wrapSelection('`'); break;
      case 'codeBlock': {
        const ta = editorRef.current;
        if (!ta) break;
        const { lineStart, lineEnd, lineText } = getLineBounds(content, ta.selectionStart);
        if (RE_CODE_FENCE.test(lineText)) {
          const next = content.slice(0, lineStart) + lineText.replace(/^```/, '') + content.slice(lineEnd);
          applyContent(next, lineStart);
        } else {
          const next = content.slice(0, lineStart) + '```\n' + content.slice(lineStart, lineEnd) + '\n```' + content.slice(lineEnd);
          applyContent(next, lineStart);
        }
        break;
      }
      case 'h1': setLineKind('heading1'); break;
      case 'h2': setLineKind('heading2'); break;
      case 'h3': setLineKind('heading3'); break;
      case 'ul': setLineKind('bullet'); break;
      case 'ol': {
        const ta = editorRef.current;
        if (!ta) break;
        const { start: rs } = getSelectionLineRange(content, ta.selectionStart, ta.selectionEnd);
        const block = content.slice(rs).split('\n');
        let counter = 1;
        transformLines((line) => {
          const raw = stripPrefix(line).replace(/\s+$/, '');
          const indent = (line.match(/^(\s*)/) || ['', ''])[1];
          const stripped = line.replace(/^\s+/, '');
          const current = detectLineKind(stripped);
          if (current.type === 'number') return indent + raw;
          return indent + (counter++) + '. ' + raw;
        });
        break;
      }
      case 'task': setLineKind('task'); break;
      case 'quote': setLineKind('quote'); break;
      case 'link': {
        const ta = editorRef.current;
        if (!ta) break;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = content.slice(start, end);
        const url = window.prompt('Enter URL:', 'https://');
        if (!url) break;
        const md = `[${selected || 'link text'}](${url})`;
        const next = content.slice(0, start) + md + content.slice(end);
        const caret = start + 1;
        applyContent(next, caret, caret + (selected ? selected.length : 'link text'.length));
        break;
      }
      default:
        break;
    }
  };

  // ----- Keyboard handling -----

  const handleKeyDown = (e) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const { lineStart, lineEnd, lineText } = getLineBounds(content, start);
      const stripped = lineText.replace(/^\s+/, '');
      const indent = (lineText.match(/^(\s*)/) || ['', ''])[1];

      const isTask = RE_TASK.test(stripped);
      const isBullet = RE_BULLET.test(stripped) && !isTask;
      const isNumber = RE_NUMBER.test(stripped);
      const isEmptyItem = stripPrefix(stripped).trim() === '';

      if (isTask || isBullet || isNumber) {
        e.preventDefault();

        if (isEmptyItem) {
          const next =
            content.slice(0, lineStart) +
            indent +
            content.slice(lineEnd);
          applyContent(next, lineStart + indent.length);
          return;
        }

        let prefix;
        if (isTask) prefix = indent + '- [ ] ';
        else if (isBullet) prefix = indent + (stripped.match(RE_BULLET)[0]);
        else {
          const n = parseInt(stripped.match(RE_NUMBER)[1], 10);
          prefix = indent + (n + 1) + '. ';
        }

        const next = content.slice(0, start) + '\n' + prefix + content.slice(end);
        applyContent(next, start + 1 + prefix.length);
        return;
      }
    }

    if (e.key === 'Backspace' && start === end) {
      const { lineStart, lineText } = getLineBounds(content, start);
      if (start === lineStart + (lineText.match(/^(\s*)/) || ['', ''])[1].length) {
        const stripped = lineText.replace(/^\s+/, '');
        if (RE_TASK.test(stripped) || RE_BULLET.test(stripped) || RE_NUMBER.test(stripped) || RE_QUOTE.test(stripped)) {
          e.preventDefault();
          const raw = stripPrefix(lineText);
          const indent = (lineText.match(/^(\s*)/) || ['', ''])[1];
          const next = content.slice(0, lineStart) + indent + raw + content.slice(lineStart + lineText.length);
          applyContent(next, lineStart + indent.length);
          return;
        }
      }
    }

    if (e.key === 'Tab') {
      const { lineText } = getLineBounds(content, start);
      const stripped = lineText.replace(/^\s+/, '');
      const isListItem =
        RE_TASK.test(stripped) ||
        RE_BULLET.test(stripped) ||
        RE_NUMBER.test(stripped) ||
        RE_QUOTE.test(stripped);

      if (isListItem) {
        e.preventDefault();
        transformLines((line) => {
          if (e.shiftKey) return line.replace(/^ {1,2}/, '');
          return '  ' + line;
        });
        return;
      }
    }
  };

  // ----- Paste handler -----

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

    const text = e.clipboardData.getData('text/plain');
    if (text && /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg|bmp)(\?\S*)?$/i.test(text.trim())) {
      e.preventDefault();
      const md = `![image](${text.trim()})`;
      insertText(md);
    }
  };

  // ----- File upload -----

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
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const md = `![image](${dataUrl})`;
        insertText(md);
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleInsertImage = () => {
    if (imageUrl.trim()) {
      const md = `![image](${imageUrl.trim()})`;
      insertText(md);
      setImageUrl('');
      setShowImageModal(false);
    }
  };

  // ----- Interactive checkbox toggling (in preview) -----

  const toggleTaskAtIndex = (taskIndex) => {
    const lines = content.split('\n');
    let seen = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)([-*•])\s+\[([ xX])\]\s+(.*)$/);
      if (m) {
        if (seen === taskIndex) {
          const indent = m[1];
          const bullet = m[2];
          const checked = m[3].toLowerCase() === 'x';
          const rest = m[4];
          lines[i] = `${indent}${bullet} [${checked ? ' ' : 'x'}] ${rest}`;
          const next = lines.join('\n');
          applyContent(next);
          return;
        }
        seen++;
      }
    }
  };

  const handlePreviewClick = (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('task-checkbox')) {
      const idx = parseInt(target.getAttribute('data-task-index'), 10);
      if (!isNaN(idx)) {
        e.preventDefault();
        toggleTaskAtIndex(idx);
      }
    }
  };

  // ----- Rendered markdown (memoized) -----

  const renderedHtml = useMemo(
    () => renderMarkdown(content, { interactiveTasks: true }),
    [content]
  );

  // ----- Autosave (only in edit mode) -----

  const autosavePayload = useMemo(
    () => ({
      title: title.trim(),
      content,
    }),
    [title, content]
  );

  const autosaveSaveFn = useCallback(
    async (payload, pw, expectedVer) => {
      if (!note?._id) return;
      const body = {
        title: payload.title,
        content: payload.content,
        currentPassword: pw,
      };
      if (typeof expectedVer === 'number') body.expectedVersion = expectedVer;
      const updated = await api.updateNote(note._id, body);
      if (updated && typeof updated.version === 'number') {
        setExpectedVersion(updated.version);
      }
      return updated;
    },
    [note?._id]
  );

  const autosaveEnabled = isEditMode && !loading && !!currentPassword && !!title.trim() && !!content.trim();

  const {
    status: autosaveStatus,
    lastSavedAt,
    conflict: autosaveConflict,
    saveNow,
    reset: resetAutosave,
  } = useDebouncedAutosave({
    id: note?._id,
    payload: autosavePayload,
    password: currentPassword,
    version: expectedVersion,
    saveFn: autosaveSaveFn,
    delayMs: 2500,
    enabled: autosaveEnabled,
  });

  // Surface a conflict banner when the hook detects one
  useEffect(() => {
    if (autosaveConflict) {
      setConflictBanner({
        serverNote: autosaveConflict,
      });
    }
  }, [autosaveConflict]);

  // ----- Submit -----

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        password: password,
        currentPassword: isEditMode ? currentPassword : undefined,
      };

      if (!noteData.title) { setError('TITLE_REQUIRED'); setLoading(false); return; }
      if (!noteData.content) { setError('CONTENT_REQUIRED'); setLoading(false); return; }

      if (!isEditMode) {
        if (!password) { setError('PASSWORD_REQUIRED: Encryption key required'); setLoading(false); return; }
        if (!validatePassword(password)) { setError(passwordValidation.message); setLoading(false); return; }
      }

      if (isEditMode) {
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
        if (typeof expectedVersion === 'number') {
          noteData.expectedVersion = expectedVersion;
        }
      }

      if (isEditMode) await onSave(note._id, noteData);
      else await onSave(noteData);

      localStorage.removeItem('note_draft');
      resetAutosave();
    } catch (err) {
      if (err && err.conflict) {
        setConflictBanner({ serverNote: err.serverNote });
      } else {
        setError(err.message || 'SAVE_FAILED');
      }
    } finally {
      setLoading(false);
    }
  };

  // ----- Conflict resolution -----

  const resolveConflictKeepMine = async () => {
    // Force the server to accept our version (skip expectedVersion) and bump locally
    setConflictBanner(null);
    if (!note?._id) return;
    try {
      const body = {
        title: title.trim(),
        content,
        currentPassword,
      };
      const updated = await api.updateNote(note._id, body);
      if (updated && typeof updated.version === 'number') setExpectedVersion(updated.version);
      resetAutosave();
    } catch (err) {
      setError(err.message || 'CONFLICT_RESOLVE_FAILED');
    }
  };

  const resolveConflictLoadServer = () => {
    if (!conflictBanner?.serverNote) return;
    const server = conflictBanner.serverNote;
    setTitle(server.title || '');
    setContent(server.content || '');
    if (typeof server.version === 'number') setExpectedVersion(server.version);
    setConflictBanner(null);
    resetAutosave();
  };

  // ----- Autosave indicator -----

  const autosaveIndicator = (() => {
    if (!isEditMode) return null;
    if (!currentPassword) {
      return (
        <span className="autosave-indicator" data-status="idle" title="Enter current password to enable autosave">
          <span className="autosave-dot" />
          AUTOSAVE_OFF
        </span>
      );
    }
    if (autosaveStatus === 'pending') {
      return (
        <span className="autosave-indicator" data-status="saving">
          <span className="autosave-dot" />
          UNSAVED_CHANGES
        </span>
      );
    }
    if (autosaveStatus === 'saving') {
      return (
        <span className="autosave-indicator" data-status="saving">
          <span className="autosave-dot" />
          SAVING…
        </span>
      );
    }
    if (autosaveStatus === 'saved') {
      return (
        <span className="autosave-indicator" data-status="saved">
          <span className="autosave-dot" />
          SAVED · {relativeTime(lastSavedAt)}
        </span>
      );
    }
    if (autosaveStatus === 'error') {
      return (
        <span className="autosave-indicator" data-status="error" title="Autosave failed. Click Save to retry.">
          <span className="autosave-dot" />
          AUTOSAVE_FAILED
        </span>
      );
    }
    if (autosaveStatus === 'conflict') {
      return (
        <span className="autosave-indicator" data-status="conflict">
          <span className="autosave-dot" />
          CONFLICT
        </span>
      );
    }
    return (
      <span className="autosave-indicator" data-status="idle">
        <span className="autosave-dot" />
        AUTOSAVE_READY
      </span>
    );
  })();

  // ----- Render -----

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={styles.title}>
              {isEditMode ? '// EDIT_NOTE' : '// CREATE_NOTE'}
            </h2>
            {autosaveIndicator}
          </div>
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            style={styles.previewToggle}
            title={isPreviewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
          >
            {isPreviewMode ? (
              <>
                <Pencil size={14} style={{ marginRight: '6px' }} />
                EDIT
              </>
            ) : (
              <>
                <EyeIcon size={14} style={{ marginRight: '6px' }} />
                PREVIEW
              </>
            )}
          </button>
        </div>

        {conflictBanner && (
          <div style={styles.conflictBanner}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong>CONFLICT:</strong> this note was updated elsewhere.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={resolveConflictLoadServer}
                style={styles.conflictButton}
              >
                LOAD_SERVER_VERSION
              </button>
              <button
                type="button"
                onClick={resolveConflictKeepMine}
                style={styles.conflictButtonDanger}
              >
                KEEP_MINE
              </button>
            </div>
          </div>
        )}

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
                  <button type="button" onClick={() => handleFormat('h1')} style={styles.toolbarButton} title="Heading 1 (click again to remove)">
                    <Heading1 size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('h2')} style={styles.toolbarButton} title="Heading 2">
                    <Heading2 size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('h3')} style={styles.toolbarButton} title="Heading 3">
                    <Heading3 size={16} />
                  </button>
                  <div style={styles.toolbarDivider} />
                  <button type="button" onClick={() => handleFormat('bold')} style={styles.toolbarButton} title="Bold (toggle)">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('italic')} style={styles.toolbarButton} title="Italic (toggle)">
                    <Italic size={16} />
                  </button>
                  <div style={styles.toolbarDivider} />
                  <button type="button" onClick={() => handleFormat('ul')} style={styles.toolbarButton} title="Bullet List (toggle)">
                    <List size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('ol')} style={styles.toolbarButton} title="Numbered List (toggle)">
                    <ListOrdered size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('task')} style={styles.toolbarButton} title="Task List (toggle)">
                    <CheckSquare size={16} />
                  </button>
                  <div style={styles.toolbarDivider} />
                  <button type="button" onClick={() => handleFormat('inlineCode')} style={styles.toolbarButton} title="Inline Code">
                    <Code size={16} />
                  </button>
                  <button type="button" onClick={() => handleFormat('codeBlock')} style={styles.toolbarButton} title="Code Block">
                    <Code size={16} style={{ fontSize: '20px' }} />
                  </button>
                  <button type="button" onClick={() => handleFormat('quote')} style={styles.toolbarButton} title="Quote (toggle)">
                    <Quote size={16} />
                  </button>
                  <div style={styles.toolbarDivider} />
                  <button type="button" onClick={() => handleFormat('link')} style={styles.toolbarButton} title="Link">
                    <Link size={16} />
                  </button>
                  <button type="button" onClick={() => setShowImageModal(true)} style={styles.toolbarButton} title="Insert Image">
                    <Image size={16} />
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.toolbarButton} title="Upload Image">
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
                  placeholder="Write your note here... Try typing '- [ ] ' for a checkbox, '- ' for bullets, '1. ' for numbers."
                  style={styles.textarea}
                  rows="15"
                  disabled={loading}
                  spellCheck={false}
                />

                <div style={styles.editorHints}>
                  <span>• Toolbar buttons toggle on/off</span>
                  <span>• Enter continues lists</span>
                  <span>• Tab indents list items</span>
                  <span>• Paste images directly</span>
                </div>
              </>
            ) : (
              <div
                style={styles.preview}
                className="note-preview"
                onClick={handlePreviewClick}
                dangerouslySetInnerHTML={{ __html: renderedHtml || '<em>Empty note</em>' }}
              />
            )}
          </div>

          {!isEditMode && (
            <div style={styles.formGroup}>
              <label style={styles.label}>ENCRYPTION_KEY <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordValidation.message && (
                <div style={{ ...styles.validationMessage, color: passwordValidation.isValid ? 'var(--accent)' : 'var(--warning)' }}>
                  {passwordValidation.message}
                </div>
              )}
            </div>
          )}

          {isEditMode && (
            <div style={styles.formGroup}>
              <label style={styles.label}>CURRENT_PASSWORD <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeButton}>
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={styles.hintText}>
                [ REQUIRED TO UPDATE THIS NOTE · AUTOSAVE USES THIS ]
              </div>
            </div>
          )}

          {isEditMode && (
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && passwordValidation.message && (
                <div style={{ ...styles.validationMessage, color: passwordValidation.isValid ? 'var(--accent)' : 'var(--warning)' }}>
                  {passwordValidation.message}
                </div>
              )}
            </div>
          )}

          {error && <div style={styles.error}>⚠️ {error}</div>}

          <div style={styles.actions}>
            <button type="submit" style={styles.saveButton} disabled={loading}>
              <Save size={14} style={{ marginRight: '6px' }} />
              {loading ? 'PROCESSING...' : (isEditMode ? 'UPDATE_NOTE' : 'CREATE_NOTE')}
            </button>
            {isEditMode && autosaveEnabled && (
              <button
                type="button"
                onClick={() => saveNow()}
                style={styles.secondaryButton}
                disabled={loading || autosaveStatus === 'saving'}
                title="Force an immediate autosave"
              >
                SAVE_NOW
              </button>
            )}
            <button type="button" onClick={onCancel} style={styles.cancelButton} disabled={loading}>
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
              <p>📋 Paste an image directly into the editor</p>
              <p>🖼️ Or upload using the toolbar upload button</p>
              <p>🔗 Or paste an image URL below</p>
            </div>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL..."
              style={styles.imageModalInput}
            />
            <div style={styles.imageModalActions}>
              <button onClick={handleInsertImage} style={styles.imageModalSubmit}>INSERT_URL</button>
              <button onClick={() => fileInputRef.current?.click()} style={styles.imageModalUpload}>
                <Upload size={16} style={{ marginRight: '6px' }} />
                UPLOAD
              </button>
              <button onClick={() => setShowImageModal(false)} style={styles.imageModalCancel}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px 0', animation: 'slideDown var(--t-base) both', width: '100%' },
  card: {
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: 'clamp(20px, 4vw, 30px)',
    boxShadow: 'var(--shadow-2)',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  title: {
    color: 'var(--accent)',
    fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
    wordBreak: 'break-word',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    margin: 0,
  },
  previewToggle: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-mono)',
    transition: 'all var(--t-fast)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    letterSpacing: '1px',
  },
  conflictBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    marginBottom: '16px',
    background: 'var(--warning-soft)',
    color: 'var(--warning)',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    flexWrap: 'wrap',
  },
  conflictButton: {
    background: 'var(--surface-2)',
    color: 'var(--accent)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    letterSpacing: '1px',
    transition: 'all var(--t-fast)',
  },
  conflictButtonDanger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    letterSpacing: '1px',
    transition: 'all var(--t-fast)',
  },
  formGroup: { marginBottom: '20px' },
  label: {
    display: 'block',
    color: 'var(--text-dim)',
    marginBottom: '8px',
    fontWeight: '700',
    fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    transition: 'all var(--t-fast)',
    outline: 'none',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px 12px 22px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'var(--font-mono)',
    transition: 'all var(--t-fast)',
    outline: 'none',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text)',
    minHeight: '260px',
    lineHeight: '1.8',
    boxSizing: 'border-box',
    overflowX: 'auto',
    whiteSpace: 'pre',
    wordWrap: 'normal',
    tabSize: 2,
  },
  preview: {
    padding: '12px 16px 12px 22px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text)',
    minHeight: '260px',
    lineHeight: '1.8',
    fontFamily: 'var(--font-mono)',
    overflow: 'auto',
    boxSizing: 'border-box',
  },
  toolbar: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    marginBottom: '8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-3)',
    flexWrap: 'wrap',
  },
  toolbarButton: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--t-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    height: '32px',
  },
  toolbarDivider: { width: '1px', background: 'var(--border)', margin: '0 4px' },
  editorHints: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
    fontSize: '0.7rem',
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    flexWrap: 'wrap',
  },
  hintText: {
    fontSize: '0.7rem',
    color: 'var(--text-faint)',
    marginTop: '4px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  passwordInputWrapper: { position: 'relative', width: '100%' },
  passwordInput: {
    width: '100%',
    padding: '10px 14px',
    paddingRight: '45px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    transition: 'all var(--t-fast)',
    outline: 'none',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
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
    color: 'var(--accent)',
    opacity: 0.6,
  },
  charCount: {
    textAlign: 'right',
    fontSize: '0.7rem',
    color: 'var(--text-faint)',
    marginTop: '4px',
    fontFamily: 'var(--font-mono)',
  },
  validationMessage: {
    fontSize: '0.75rem',
    marginTop: '4px',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap',
  },
  saveButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'var(--accent)',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: '1px dashed var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.75rem, 1.4vw, 0.85rem)',
    cursor: 'pointer',
    minWidth: '100px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
  },
  cancelButton: {
    backgroundColor: 'rgba(127, 127, 127, 0.05)',
    color: 'var(--text-dim)',
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 24px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    cursor: 'pointer',
    flex: 1,
    minWidth: '120px',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
  },
  error: {
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: '10px 15px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '15px',
    border: '1px solid var(--danger)',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontFamily: 'var(--font-mono)',
  },
  imageModalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px',
  },
  imageModal: {
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    padding: '30px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: 'var(--shadow-2)',
  },
  imageModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  imageModalTitle: {
    color: 'var(--accent)',
    fontSize: '1rem',
    fontFamily: 'var(--font-mono)',
    margin: 0,
  },
  imageModalClose: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  imageModalHint: {
    backgroundColor: 'var(--surface-2)',
    padding: '12px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px',
    border: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-mono)',
  },
  imageModalInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-1)',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    marginBottom: '16px',
    outline: 'none',
  },
  imageModalActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  imageModalSubmit: {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent)',
    padding: '10px 20px',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    flex: 1,
    minWidth: '80px',
  },
  imageModalUpload: {
    backgroundColor: 'var(--warning-soft)',
    color: 'var(--warning)',
    padding: '10px 20px',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    flex: 1,
    minWidth: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalCancel: {
    backgroundColor: 'rgba(127, 127, 127, 0.05)',
    color: 'var(--text-dim)',
    padding: '10px 20px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    flex: 1,
    minWidth: '80px',
  },
};

export default NoteEditor;