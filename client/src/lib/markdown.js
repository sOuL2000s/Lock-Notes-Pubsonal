// client/src/lib/markdown.js
// Single source of truth for markdown → safe HTML conversion.
// Uses marked for parsing, DOMPurify for sanitization, highlight.js for code.

import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';

// Build a marked instance with our options.
const marked = new Marked({
  gfm: true,
  breaks: true, // single newline → <br> (matches previous app behavior)
  pedantic: false,
  smartypants: false,
});

// Custom renderer so code blocks get highlight.js classes that our CSS styles.
const renderer = {
  code(code, infostring) {
    const lang = (infostring || '').trim().split(/\s+/)[0].toLowerCase();
    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch (e) {
        highlighted = escapeHtml(code);
      }
    } else {
      // Auto-detect, but default to plain if uncertain
      try {
        const result = hljs.highlightAuto(code);
        highlighted = result.value;
      } catch (e) {
        highlighted = escapeHtml(code);
      }
    }
    const cls = lang ? ` class="hljs language-${lang}"` : ' class="hljs"';
    return `<pre><code${cls}>${highlighted}</code></pre>`;
  },
  // Add target/rel to links, keep images safe
  link(href, title, text) {
    const safeHref = sanitizeUrl(href);
    const t = title ? ` title="${escapeAttr(title)}"` : '';
    return `<a href="${safeHref}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
  },
  image(href, title, text) {
    const safeSrc = sanitizeImageUrl(href);
    if (!safeSrc) return escapeHtml(text || '');
    const t = title ? ` title="${escapeAttr(title)}"` : '';
    const alt = escapeAttr(text || 'image');
    return `<img src="${safeSrc}" alt="${alt}"${t} style="max-width:100%;border-radius:6px;margin:10px 0;display:block;" />`;
  },
  // Tables get our class
  table(header, body) {
    return `<table class="md-table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
  },
  // Task list items: marked already emits <li class="task-list-item">
  // We just wrap the checkbox so it's styled consistently.
  listitem(text, task, checked) {
    if (task) {
      return `<li class="task-item${checked ? ' checked' : ''}">${text}</li>`;
    }
    return `<li>${text}</li>`;
  },
};

marked.use({ renderer });

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeUrl(url) {
  const u = String(url || '').trim();
  if (/^(https?:|mailto:|\/|#)/i.test(u)) return escapeAttr(u);
  return '#';
}

function sanitizeImageUrl(url) {
  const u = String(url || '').trim();
  if (/^(https?:|data:image\/|\/)/i.test(u)) return escapeAttr(u);
  return '';
}

// DOMPurify config: allow task-list checkbox attributes we emit.
const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel', 'data-task-index'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data:image\/)|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Convert a markdown string to sanitized HTML.
 * @param {string} text
 * @param {{ interactiveTasks?: boolean }} opts
 *        interactiveTasks=true → checkboxes get data-task-index and are not disabled (editor preview)
 *        interactiveTasks=false (default) → checkboxes are disabled (viewer, share page)
 */
export function renderMarkdown(text, opts = {}) {
  if (!text) return '';

  let raw = marked.parse(text);

  // Post-process task list items so the viewer checkbox markup matches what
  // the editor's click handler expects.
  raw = postProcessTaskLists(raw, opts.interactiveTasks === true);

  return DOMPurify.sanitize(raw, PURIFY_CONFIG);
}

// Assign data-task-index sequentially and optionally make checkboxes interactive.
function postProcessTaskLists(html, interactive) {
  let idx = 0;
  return html.replace(/<input([^>]*?)type="checkbox"([^>]*?)>/g, (match, a, b) => {
    const checked = /checked/.test(a + b);
    const attrs = [
      'type="checkbox"',
      checked ? 'checked' : '',
      interactive ? `data-task-index="${idx}"` : 'disabled',
      interactive ? 'class="task-checkbox"' : 'class="task-checkbox-viewer"',
    ].filter(Boolean).join(' ');
    idx += 1;
    return `<input ${attrs} />`;
  });
}

// Convenience: highlight.js language list (used by the editor's language hint)
export function isSupportedLanguage(lang) {
  return !!hljs.getLanguage(String(lang || '').toLowerCase());
}