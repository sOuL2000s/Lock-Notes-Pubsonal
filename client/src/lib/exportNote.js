// client/src/lib/exportNote.js
// Export a note as Markdown, plain text, or PDF.
//
// Markdown/Text are trivial — we just build a Blob and trigger a download.
// PDF uses the browser's native print-to-PDF functionality via a hidden
// iframe. To make the PDF look EXACTLY like the website, we:
//   1. Copy the current CSS custom properties (--accent, --bg, etc.) from
//      the live document into the iframe so the theme matches.
//   2. Copy all stylesheets from the main document into the iframe.
//   3. Preserve the note-preview markup and classes so the site's own CSS
//      rules apply.
//   4. Add only minimal print-specific tweaks (@page, page breaks).

/**
 * Trigger a browser download for a Blob.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke a tick later so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Sanitize a note title so it can be used as a filename.
 */
export function safeFilename(title, fallback = 'note') {
  const base = String(title || '').trim() || fallback;
  return base
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/**
 * Export as Markdown. We prepend a small YAML-ish front-matter block so the
 * file is self-describing if someone opens it in a text editor.
 */
export function exportAsMarkdown(note) {
  const title = note?.title || 'Untitled';
  const created = note?.createdAt ? new Date(note.createdAt).toISOString() : '';
  const updated = note?.updatedAt ? new Date(note.updatedAt).toISOString() : '';
  const header = [
    '---',
    `title: ${JSON.stringify(title)}`,
    created ? `created: ${created}` : null,
    updated && updated !== created ? `updated: ${updated}` : null,
    '---',
    '',
    `# ${title}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  const body = note?.content || '';
  const blob = new Blob([header + body + '\n'], {
    type: 'text/markdown;charset=utf-8',
  });
  downloadBlob(blob, `${safeFilename(title)}.md`);
}

/**
 * Export as plain text. We strip the most common Markdown syntax so the
 * result reads cleanly in a .txt viewer.
 */
export function exportAsText(note) {
  const title = note?.title || 'Untitled';
  const raw = note?.content || '';

  const plain = raw
    // Fenced code blocks: keep the code, drop the fences
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    // Inline code: drop backticks
    .replace(/`([^`]+)`/g, '$1')
    // Headings: drop leading #
    .replace(/^#{1,6}\s+/gm, '')
    // Blockquotes
    .replace(/^>\s?/gm, '')
    // Bold / italic / strikethrough
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Links: [text](url) -> text (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Images: ![alt](url) -> [image: alt]
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt) => (alt ? `[image: ${alt}]` : '[image]'))
    // Horizontal rules
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, '----------')
    // Task list markers
    .replace(/^(\s*)[-*]\s+\[x\]\s+/gim, '$1[x] ')
    .replace(/^(\s*)[-*]\s+\[\s\]\s+/gm, '$1[ ] ')
    ;

  const text = `${title}\n${'='.repeat(Math.min(title.length, 80))}\n\n${plain}\n`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(title)}.txt`);
}

/**
 * Collect all CSS custom properties defined on :root / [data-theme] from the
 * current document so we can replay them inside the print iframe.
 */
function collectThemeVariables() {
  const rootStyle = getComputedStyle(document.documentElement);
  const vars = {};

  // A list of all the design tokens our app uses. We read them from the
  // live computed style so whatever theme is active gets baked in.
  const tokens = [
    '--accent', '--accent-soft', '--accent-line', '--accent-glow',
    '--accent-fn', '--accent-num', '--accent-str', '--accent-com',
    '--danger', '--danger-soft', '--warning', '--warning-soft',
    '--bg', '--bg-elev', '--surface-1', '--surface-2', '--surface-3',
    '--text', '--text-strong', '--text-dim', '--text-faint',
    '--border', '--border-strong', '--border-accent',
    '--code-bg', '--code-border',
    '--shadow-1', '--shadow-2',
    '--option-bg', '--option-fg', '--option-bg-selected', '--option-fg-selected',
    '--font-mono', '--radius-sm', '--radius-md', '--radius-lg',
    '--t-fast', '--t-base', '--t-slow',
  ];

  tokens.forEach((name) => {
    const value = rootStyle.getPropertyValue(name);
    if (value) vars[name] = value.trim();
  });

  return vars;
}

/**
 * Serialize the current theme's custom properties into a `:root { ... }`
 * CSS block. We also include the current `data-theme` value on <html>.
 */
function themeVariablesToCss(vars) {
  const lines = Object.entries(vars).map(([k, v]) => `    ${k}: ${v};`);
  return `:root {\n${lines.join('\n')}\n  }`;
}

/**
 * Clone every <style> and <link rel="stylesheet"> from the main document
 * so the iframe renders with the same rules as the live page.
 */
function collectStylesheets() {
  const parts = [];

  // Inline <style> blocks
  document.querySelectorAll('style').forEach((node) => {
    if (node.textContent) parts.push(node.textContent);
  });

  // Linked stylesheets — we fetch their rules if same-origin, otherwise
  // fall back to a <link> tag in the iframe.
  const links = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    try {
      // Same-origin: inline the rules so they definitely apply in the iframe
      const sheet = link.sheet;
      if (sheet && sheet.cssRules) {
        const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
        parts.push(rules);
      } else {
        links.push(link.href);
      }
    } catch (e) {
      // Cross-origin stylesheet — fall back to <link>
      links.push(link.href);
    }
  });

  return { inlineCss: parts.join('\n\n'), externalLinks: links };
}

/**
 * Export as PDF using the browser's native print-to-PDF functionality.
 *
 * Renders the note using the SAME stylesheet + theme tokens as the live
 * page, so the resulting PDF matches what the user sees on screen.
 *
 * @param {object} note        - the note object ({ title, content, ... })
 * @param {HTMLElement} sourceEl - the DOM node to render (the .note-preview div)
 * @param {(msg: string) => void} [onProgress] - optional status callback
 */
export async function exportAsPdf(note, sourceEl, onProgress) {
  if (!sourceEl) throw new Error('PREVIEW_ELEMENT_NOT_FOUND');

  const title = note?.title || 'Untitled';

  onProgress?.('PREPARING_PRINT…');

  // 1. Grab the live theme tokens + stylesheets.
  const themeVars = collectThemeVariables();
  const themeCss = themeVariablesToCss(themeVars);
  const { inlineCss, externalLinks } = collectStylesheets();
  const currentTheme =
    document.documentElement.getAttribute('data-theme') || 'dark';

  // 2. Clone the rendered content so we don't disturb the live DOM.
  const contentClone = sourceEl.cloneNode(true);

  // Make checkbox inputs static (they should just render as-is in the PDF).
  contentClone.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.disabled = true;
    cb.removeAttribute('data-task-index');
  });

  // 3. Build the print document. We keep the `note-preview` class so the
  //    app's own CSS applies, and we bake in the theme variables + all
  //    stylesheets from the live page.
  const printHtml = buildPrintDocument({
    title,
    note,
    contentHtml: contentClone.outerHTML,
    themeCss,
    inlineCss,
    externalLinks,
    currentTheme,
  });

  // 4. Create a hidden iframe.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Print preview');

  document.body.appendChild(iframe);

  try {
    onProgress?.('RENDERING…');

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    // 5. Wait for external stylesheets + images to finish loading.
    await waitForIframeReady(iframe);

    onProgress?.('OPENING_PRINT_DIALOG…');

    const iframeWindow = iframe.contentWindow;

    // Small delay to ensure layout is settled.
    await new Promise((resolve) => setTimeout(resolve, 350));

    iframeWindow.focus();
    iframeWindow.print();

    onProgress?.('DONE');

    // Clean up the iframe after a generous delay — some browsers show a
    // non-blocking print preview and we don't want to yank it away early.
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 60000);
  } catch (err) {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    throw err;
  }
}

/**
 * Wait for the iframe's document + external resources to be ready.
 */
function waitForIframeReady(iframe) {
  return new Promise((resolve) => {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    const done = () => setTimeout(resolve, 200);

    // Wait for all <link rel="stylesheet"> to load, if any remain.
    const links = Array.from(
      iframeDoc.querySelectorAll('link[rel="stylesheet"]')
    );
    const pending = links.filter((l) => !l.sheet);
    if (pending.length === 0 && iframeDoc.readyState === 'complete') {
      done();
      return;
    }

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      done();
    };

    // Wait for the load event as a fallback.
    iframe.addEventListener('load', finish);

    // Then wait for each pending stylesheet.
    Promise.all(
      pending.map(
        (l) =>
          new Promise((r) => {
            l.addEventListener('load', r, { once: true });
            l.addEventListener('error', r, { once: true });
          })
      )
    ).then(finish);

    // Hard fallback timeout.
    setTimeout(finish, 3000);
  });
}

/**
 * Build the HTML document for the print iframe. Everything the live page
 * uses (theme tokens, app stylesheets, note-preview markup) is preserved.
 * We only add the minimum print-specific tweaks: @page size/margins and
 * page-break rules so long notes paginate cleanly.
 */
function buildPrintDocument({
  title,
  note,
  contentHtml,
  themeCss,
  inlineCss,
  externalLinks,
  currentTheme,
}) {
  const created = note?.createdAt
    ? new Date(note.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const updated =
    note?.updatedAt && note.updatedAt !== note.createdAt
      ? new Date(note.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

  const linkTags = externalLinks
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n  ');

  return `<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  ${linkTags}

  <style>
    /* ---- Live theme tokens captured from the current page ---- */
    ${themeCss}

    /* ---- App stylesheets (copied from the live document) ---- */
    ${inlineCss}

    /* ============================================================
       Print-specific tweaks ONLY.
       Everything visual comes from the app's own CSS above, so the
       PDF matches the on-screen appearance.
       ============================================================ */

    /* Ensure background colors / code blocks / task checkboxes are
       printed by the browser (they're often stripped by default). */
    html,
    body,
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Page size + margins. The body padding below mirrors what the
       app uses on screen so content doesn't touch the paper edge. */
    @page {
      size: A4;
      margin: 14mm;
    }

    /* Kill screen-only chrome inside the print iframe. */
    html, body {
      background: var(--bg) !important;
      color: var(--text) !important;
      padding: 0;
      margin: 0;
    }

    body {
      /* Extra breathing room on paper. */
      padding: 6mm;
    }

    /* The note card on screen is inside a bordered card with rounded
       corners. Reproduce that wrapper here for a faithful print. */
    .print-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: var(--bg-elev);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 32px 40px;
      box-shadow: none;
      color: var(--text);
      font-family: var(--font-mono);
    }

    /* Header block — title + meta, styled like the viewer. */
    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }

    .print-title {
      color: var(--accent);
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      word-break: break-word;
      font-family: var(--font-mono);
      text-shadow: none;
    }

    .print-badge {
      background: var(--surface-2);
      color: var(--accent);
      padding: 4px 12px;
      border-radius: var(--radius-sm);
      font-size: 0.7rem;
      font-weight: 700;
      font-family: var(--font-mono);
      white-space: nowrap;
      border: 1px solid var(--border-strong);
      display: inline-flex;
      align-items: center;
    }

    .print-meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--text-faint);
    }

    .print-meta span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* The note content itself — the app's .note-preview rules handle
       all typography, code styling, task lists, tables, etc. */
    .note-preview {
      margin-bottom: 8px;
    }

    /* Footer line, matching the terminal aesthetic. */
    .print-footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 0.7rem;
      letter-spacing: 1px;
      color: var(--text-faint);
      text-align: center;
    }

    /* ---- Pagination rules ---- */
    @media print {
      pre,
      blockquote,
      table,
      img {
        page-break-inside: avoid;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      .print-wrapper {
        border: none;
        padding: 0;
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    <div class="print-header">
      <h1 class="print-title">${escapeHtml(title)}</h1>
      <span class="print-badge">🔒 ENCRYPTED</span>
    </div>

    <div class="print-meta">
      ${created ? `<span>CREATED: ${escapeHtml(created)}</span>` : ''}
      ${updated ? `<span>UPDATED: ${escapeHtml(updated)}</span>` : ''}
      ${typeof note?.version === 'number' ? `<span>V${note.version}</span>` : ''}
    </div>

    ${contentHtml}

    <div class="print-footer">
      [ EXPORTED FROM LOCK NOTES · ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).toUpperCase()} ]
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters for safe insertion into the document.
 */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}