// client/src/lib/markdown.js
// Single source of truth for markdown → safe HTML conversion.
// Uses marked for parsing, DOMPurify for sanitization, highlight.js for code.

import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';

// ---------- shared heading slugger ----------
// Both the renderer (for id="...") and the TOC extractor use the same logic,
// so heading IDs always match between the two.

/**
 * Extract headings from raw markdown source, in document order.
 * Returns [{ level, text, id }]. IDs are deterministic and match the
 * ones the renderer assigns via `renderMarkdown`.
 *
 * Duplicate heading texts get a numeric suffix (-1, -2, ...).
 * Fenced code blocks are skipped so "# not a heading" inside code doesn't count.
 */
export function extractHeadingList(markdown) {
  if (!markdown) return [];

  const out = [];
  const lines = String(markdown).split('\n');
  let inFence = false;
  const counts = new Map();

  for (const line of lines) {
    // Track fenced code blocks
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // ATX headings: # H1, ## H2, ### H3 (cap at 3 to match our editor toolbar)
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;

    const level = m[1].length;
    const rawText = m[2].trim();
    if (!rawText) continue;

    // Strip inline markdown so the slug matches what marked renders
    const plain = rawText
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    const base = plain
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';

    const c = counts.get(base) || 0;
    counts.set(base, c + 1);
    const id = c === 0 ? base : `${base}-${c}`;

    out.push({ level, text: rawText, id });
  }

  return out;
}

/**
 * Build a marked instance with our options. The heading renderer consumes
 * the precomputed IDs from extractHeadingList so the DOM IDs are stable
 * and always match the TOC.
 */
function buildMarked(markdown) {
  const headings = extractHeadingList(markdown);
  let hi = 0;

  const marked = new Marked({
    gfm: true,
    breaks: true, // single newline → <br> (matches previous app behavior)
    pedantic: false,
    smartypants: false,
  });

  const renderer = {
    // Assign the precomputed ID for this heading
    heading(text, level) {
      const h = headings[hi++];
      const id = h ? h.id : 'section';
      return `<h${level} id="${id}">${text}</h${level}>`;
    },

    // Custom renderer so code blocks get highlight.js classes that our CSS styles.
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
  return marked;
}

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

// DOMPurify config: allow task-list checkbox attributes we emit + heading ids.
const PURIFY_CONFIG = {
  ADD_ATTR: ['target', 'rel', 'data-task-index', 'id'],
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

  const marked = buildMarked(text);
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