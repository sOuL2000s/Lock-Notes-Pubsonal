// client/src/components/NoteEditor.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye, EyeOff, Image, Link, Bold, Italic,
  List, ListOrdered, Code, Quote, Heading1, Heading2, Heading3,
  Upload, X, CheckSquare, Eye as EyeIcon, Pencil, Undo2, Redo2
} from 'lucide-react';

// ----- Line-level helpers -----

// Given a full text + a character index, return { lineStart, lineEnd, lineText }
const getLineBounds = (text, index) => {
  const clamped = Math.max(0, Math.min(index, text.length));
  const lineStart = text.lastIndexOf('\n', clamped - 1) + 1;
  const nextNl = text.indexOf('\n', clamped);
  const lineEnd = nextNl === -1 ? text.length : nextNl;
  return { lineStart, lineEnd, lineText: text.slice(lineStart, lineEnd) };
};

// Given text + a character index, return the [start, end] char range of all
// lines that overlap the given selection [selStart, selEnd].
const getSelectionLineRange = (text, selStart, selEnd) => {
  const first = getLineBounds(text, selStart);
  const last = getLineBounds(text, selEnd);
  return { start: first.lineStart, end: last.lineEnd };
};

// Prefix patterns
const RE_H = /^(#{1,3})\s+/;
const RE_QUOTE = /^>\s+/;
const RE_BULLET = /^[-*•]\s+/;
const RE_NUMBER = /^(\d+)\.\s+/;
const RE_TASK = /^[-*•]\s+\[([ xX])\]\s+/;
const RE_CODE_FENCE = /^```/;

// Detect the "kind" of a single line
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

// Strip any list/heading/quote prefix from a line and return the raw content
const stripPrefix = (line) => {
  return line
    .replace(RE_TASK, '')
    .replace(RE_BULLET, '')
    .replace(RE_NUMBER, '')
    .replace(RE_H, '')
    .replace(RE_QUOTE, '');
};

function NoteEditor({ note, preVerifiedPassword = '', onSave, onCancel }) {
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

  // Manual undo/redo stacks for programmatic edits (toolbar clicks, checkbox toggles)
  const historyRef = useRef({ stack: [], index: -1, applying: false });

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // ----- Lifecycle -----

  useEffect(() => {
    setIsPreviewMode(false);
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setPassword('');
      setCurrentPassword(preVerifiedPassword || '');
      setPasswordValidation({ isValid: false, message: '' });
    } else {
      setTitle('');
      setContent('');
      setPassword('');
      setCurrentPassword('');
      setPasswordValidation({ isValid: false, message: '' });
      localStorage.removeItem('note_draft');
    }
    historyRef.current = { stack: [], index: -1, applying: false };
  }, [note, preVerifiedPassword]);

  // Auto-save draft for new notes only
  useEffect(() => {
    if (note) return;
    const saveDraft = () => {
      if (title || content) {
        localStorage.setItem('note_draft', JSON.stringify({ title, content, timestamp: Date.now() }));
      }
    };
    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(saveDraft);
  }, [title, content, note]);

  // Load draft once
  useEffect(() => {
    const draft = localStorage.getItem('note_draft');
    if (draft && !note) {
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
    // Truncate redo branch
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(value);
    h.index = h.stack.length - 1;
    // Cap at 100
    if (h.stack.length > 100) {
      h.stack.shift();
      h.index--;
    }
  };

  // Apply new content programmatically, without losing cursor if possible
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

  const handleUndo = () => {
    const ta = editorRef.current;
    if (ta) {
      // Prefer native undo if the textarea has focus and history
      try {
        ta.focus();
        // eslint-disable-next-line no-unused-expressions
        document.execCommand && document.execCommand('undo');
      } catch (e) { /* noop */ }
    }
  };

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

  // Toggle or apply a marker to all lines in the current selection.
  // markerFn: (line, ctx) => string  -- returns the new line text
  // The function receives the raw line; it must decide whether to strip or add.
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

  // Generic "set this line to kind K" (converts from any other list kind)
  // kind: 'plain' | 'bullet' | 'number' | 'task' | 'quote' | 'heading1..3' | 'code'
  const setLineKind = (kind, opts = {}) => {
    transformLines((line) => {
      const raw = stripPrefix(line).replace(/\s+$/, '');
      const stripped = line.replace(/^\s+/, '');
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      // Toggle-off behavior: if the line already has exactly this kind, strip to plain
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

      // If clicking the same kind → toggle off
      if (alreadyThis && kind !== 'plain') {
        return indent + raw;
      }

      switch (kind) {
        case 'plain':
          return indent + raw;
        case 'bullet':
          return indent + '- ' + raw;
        case 'number':
          return indent + (opts.n || 1) + '. ' + raw;
        case 'task':
          return indent + '- [ ] ' + raw;
        case 'quote':
          return indent + '> ' + raw;
        case 'heading1':
          return indent + '# ' + raw;
        case 'heading2':
          return indent + '## ' + raw;
        case 'heading3':
          return indent + '### ' + raw;
        case 'code':
          return indent + '```' + raw;
        default:
          return line;
      }
    });
  };

  // Wrap or unwrap a selection with a pair of markers (for **, *, `, etc.)
  const wrapSelection = (prefix, suffix = prefix) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);

    // If selection is already wrapped, unwrap it
    if (
      before.endsWith(prefix) &&
      after.startsWith(suffix) &&
      selected.length >= 0
    ) {
      const next =
        before.slice(0, before.length - prefix.length) +
        selected +
        after.slice(suffix.length);
      const newStart = start - prefix.length;
      applyContent(next, newStart, newStart + selected.length);
      return;
    }

    // If the selection itself starts with prefix and ends with suffix, unwrap inside
    if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
      const inner = selected.slice(prefix.length, selected.length - suffix.length);
      const next = before + inner + after;
      applyContent(next, start, start + inner.length);
      return;
    }

    // Otherwise wrap
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
      case 'bold':
        wrapSelection('**');
        break;
      case 'italic':
        wrapSelection('*');
        break;
      case 'inlineCode':
        wrapSelection('`');
        break;
      case 'codeBlock': {
        const ta = editorRef.current;
        if (!ta) break;
        const { lineStart, lineEnd, lineText } = getLineBounds(content, ta.selectionStart);
        if (RE_CODE_FENCE.test(lineText)) {
          // Remove fences on this line only
          const next = content.slice(0, lineStart) + lineText.replace(/^```/, '') + content.slice(lineEnd);
          applyContent(next, lineStart);
        } else {
          const next = content.slice(0, lineStart) + '```\n' + content.slice(lineStart, lineEnd) + '\n```' + content.slice(lineEnd);
          applyContent(next, lineStart);
        }
        break;
      }
      case 'h1':
        setLineKind('heading1');
        break;
      case 'h2':
        setLineKind('heading2');
        break;
      case 'h3':
        setLineKind('heading3');
        break;
      case 'ul':
        setLineKind('bullet');
        break;
      case 'ol': {
        // Number based on index inside selection
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
      case 'task':
        setLineKind('task');
        break;
      case 'quote':
        setLineKind('quote');
        break;
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

    // ---- Enter: list continuation ----
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

        // Empty item → drop marker and exit list
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
        else if (isBullet) prefix = indent + (stripped.match(RE_BULLET)[0]) ;
        else {
          const n = parseInt(stripped.match(RE_NUMBER)[1], 10);
          prefix = indent + (n + 1) + '. ';
        }

        const next = content.slice(0, start) + '\n' + prefix + content.slice(end);
        applyContent(next, start + 1 + prefix.length);
        return;
      }
    }

    // ---- Backspace at start of a list item: smart merge ----
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

    // ---- Tab: indent / outdent list items ----
    if (e.key === 'Tab') {
      const { lineText } = getLineBounds(content, start);
      const stripped = lineText.replace(/^\s+/, '');
      const isListItem = RE_TASK.test(stripped) || RE_BULLET.test(stripped) || RE_NUMBER.test(stripped) || RE_QUOTE.test(stripped);

      if (isListItem) {
        e.preventDefault();
        transformLines((line) => {
          if (e.shiftKey) {
            // Outdent: remove 2 spaces from the start
            return line.replace(/^ {1,2}/, '');
          } else {
            // Indent: add 2 spaces
            return '  ' + line;
          }
        });
        return;
      }
    }

    // ---- Mod+Z / Mod+Y: leave to native undo ----
    // (No override — native textarea undo handles typed changes.)
  };

  // ----- Paste handler -----

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // If a URL or text is pasted and it's an image URL, insert as markdown image
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

  // When a checkbox in preview mode is clicked, we need to find which task
  // line in the source corresponds to it, and flip [ ] ↔ [x].
  const toggleTaskAtIndex = (taskIndex) => {
    // Find the Nth task line in the content (0-based)
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

    // 1) Protect fenced code blocks (with language + syntax highlighting)
    src = src.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const trimmed = code.replace(/\n$/, '');
      const html = highlightCode(trimmed, lang);
      const cls = lang ? ` class="language-${lang.toLowerCase()}"` : '';
      return stash(`<pre><code${cls}>${html}</code></pre>`);
    });

    // 2) Protect inline code (must run AFTER fenced blocks)
    src = src.replace(/`([^`\n]+)`/g, (_, code) =>
      stash(`<code>${escapeHtml(code)}</code>`)
    );

    // 3) Protect images (markdown syntax) BEFORE escaping
    src = src.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = /^(https?:|data:image\/|\/)/i.test(url.trim()) ? url.trim() : '';
      if (!safe) return '';
      return stash(
        `<img src="${safe}" alt="${escapeHtml(alt || 'image')}" style="max-width:100%;border-radius:4px;margin:8px 0;display:block;" />`
      );
    });

    // 3b) Protect raw <img ...> tags
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

    // 4) Escape HTML
    src = escapeHtml(src);

    // 5) Split into lines for block-level processing
    const lines = src.split('\n');
    const out = [];
    let taskIndex = 0;

    let i = 0;
    let inList = null; // 'ul' | 'ol'
    let listBuf = [];

    const flushList = () => {
      if (inList) {
        out.push(`<${inList}>${listBuf.join('')}</${inList}>`);
        listBuf = [];
        inList = null;
      }
    };

    while (i < lines.length) {
      let line = lines[i];

      // Task list item
      const taskMatch = line.match(/^([-*•])\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        flushList();
        const checked = taskMatch[2].toLowerCase() === 'x';
        const textContent = taskMatch[3];
        const idx = taskIndex++;
        out.push(
          `<div class="task-item${checked ? ' checked' : ''}">` +
          `<input type="checkbox" ${checked ? 'checked' : ''} data-task-index="${idx}" class="task-checkbox" />` +
          `<span>${textContent}</span>` +
          `</div>`
        );
        i++;
        continue;
      }

      // Bullet list item
      const bulletMatch = line.match(/^([-*•])\s+(.*)$/);
      if (bulletMatch) {
        if (inList !== 'ul') { flushList(); inList = 'ul'; }
        listBuf.push(`<li>${bulletMatch[2]}</li>`);
        i++;
        continue;
      }

      // Numbered list item
      const numMatch = line.match(/^\d+\.\s+(.*)$/);
      if (numMatch) {
        if (inList !== 'ol') { flushList(); inList = 'ol'; }
        listBuf.push(`<li>${numMatch[1]}</li>`);
        i++;
        continue;
      }

      // Any other line terminates current list
      flushList();

      // Horizontal rule
      if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
        out.push('<hr />');
        i++;
        continue;
      }

      // GFM tables: header row + separator row + body rows
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

      // Heading
      if (/^### (.*)$/.test(line)) { out.push(line.replace(/^### (.*)$/, '<h3>$1</h3>')); i++; continue; }
      if (/^## (.*)$/.test(line)) { out.push(line.replace(/^## (.*)$/, '<h2>$1</h2>')); i++; continue; }
      if (/^# (.*)$/.test(line)) { out.push(line.replace(/^# (.*)$/, '<h1>$1</h1>')); i++; continue; }

      // Blockquote
      if (/^&gt;\s?(.*)$/.test(line)) {
        out.push(line.replace(/^&gt;\s?(.*)$/, '<blockquote>$1</blockquote>'));
        i++;
        continue;
      }

      out.push(line);
      i++;
    }
    flushList();

    src = out.join('\u0000BLK\u0000');

    // 6) Inline formatting
    src = src.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    src = src.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    src = src.replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>');
    src = src.replace(/__(.+?)__/g, '<u>$1</u>');

    // 7) Links
    src = src.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safe = /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : '#';
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    // 8) Restore placeholders
    src = src.replace(/\u0000PH(\d+)\u0000/g, (_, idx) => placeholders[Number(idx)] || '');

    // 9) Line breaks on remaining newlines (but not inside <pre>)
    src = src.replace(/\n/g, '<br />');

    // 10) Restore block separators
    src = src.replace(/\u0000BLK\u0000/g, '\n');

    return src;
  };

  // Handle checkbox clicks in preview
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
        currentPassword: note ? currentPassword : undefined
      };

      if (!noteData.title) { setError('TITLE_REQUIRED'); setLoading(false); return; }
      if (!noteData.content) { setError('CONTENT_REQUIRED'); setLoading(false); return; }

      if (!note) {
        if (!password) { setError('PASSWORD_REQUIRED: Encryption key required'); setLoading(false); return; }
        if (!validatePassword(password)) { setError(passwordValidation.message); setLoading(false); return; }
      }

      if (note) {
        if (!currentPassword) { setError('CURRENT_PASSWORD_REQUIRED: Enter current password to make changes'); setLoading(false); return; }
        if (password && !validatePassword(password)) { setError(passwordValidation.message); setLoading(false); return; }
      }

      if (note) await onSave(note._id, noteData);
      else await onSave(noteData);

      localStorage.removeItem('note_draft');
    } catch (err) {
      setError(err.message || 'SAVE_FAILED');
    } finally {
      setLoading(false);
    }
  };

  // ----- Render -----

  const renderedHtml = renderMarkdown(content);

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
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordValidation.message && (
                <div style={{ ...styles.validationMessage, color: passwordValidation.isValid ? '#00ff41' : '#ffa500' }}>
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
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeButton}>
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && passwordValidation.message && (
                <div style={{ ...styles.validationMessage, color: passwordValidation.isValid ? '#00ff41' : '#ffa500' }}>
                  {passwordValidation.message}
                </div>
              )}
            </div>
          )}

          {error && <div style={styles.error}>⚠️ {error}</div>}

          <div style={styles.actions}>
            <button type="submit" style={styles.saveButton} disabled={loading}>
              {loading ? 'PROCESSING...' : (note ? 'UPDATE_NOTE' : 'CREATE_NOTE')}
            </button>
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
  container: { padding: '20px 0', animation: 'slideDown 0.3s ease', width: '100%' },
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  title: { color: '#00ff41', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', wordBreak: 'break-word', fontFamily: 'monospace', letterSpacing: '1px' },
  previewToggle: {
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
    color: '#00ff41',
    padding: '8px 16px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    transition: 'all 0.3s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    letterSpacing: '1px'
  },
  formGroup: { marginBottom: '20px' },
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
    padding: '12px 16px 12px 22px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'monospace',
    transition: 'all 0.3s ease',
    outline: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    minHeight: '260px',
    lineHeight: '1.8',
    boxSizing: 'border-box',
    overflowX: 'auto',
    whiteSpace: 'pre',
    wordWrap: 'normal',
    tabSize: 2
  },
  preview: {
    padding: '12px 16px 12px 22px',
    border: '1px solid rgba(0, 255, 65, 0.2)',
    borderRadius: '2px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#00ff41',
    minHeight: '260px',
    lineHeight: '1.8',
    fontFamily: 'monospace',
    overflow: 'auto',
    boxSizing: 'border-box'
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
  toolbarDivider: { width: '1px', background: 'rgba(0, 255, 65, 0.1)', margin: '0 4px' },
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
  passwordInputWrapper: { position: 'relative', width: '100%' },
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
    opacity: 0.6
  },
  charCount: { textAlign: 'right', fontSize: '0.7rem', color: '#00ff41', opacity: 0.4, marginTop: '4px', fontFamily: 'monospace' },
  validationMessage: { fontSize: '0.75rem', marginTop: '4px', fontWeight: '600', fontFamily: 'monospace' },
  actions: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' },
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
    top: 0, left: 0, right: 0, bottom: 0,
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
  imageModalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  imageModalTitle: { color: '#00ff41', fontSize: '1rem', fontFamily: 'monospace', margin: 0 },
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
  imageModalActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
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