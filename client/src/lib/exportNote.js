// client/src/lib/exportNote.js
// Export a note as Markdown, plain text, or PDF.
//
// Markdown/Text are trivial — we just build a Blob and trigger a download.
// PDF uses jsPDF + html2canvas, loaded lazily so they don't bloat the main
// bundle. html2canvas renders the note's *preview* DOM (the same markup the
// viewer shows) into a canvas, which we then paginate into a jsPDF document.

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
    // Bullet markers -> keep as-is (they read fine in plain text)
    ;

  const text = `${title}\n${'='.repeat(Math.min(title.length, 80))}\n\n${plain}\n`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(title)}.txt`);
}

/**
 * Export as PDF. Renders the note's preview DOM into a canvas via
 * html2canvas, then slices the canvas into A4-sized pages.
 *
 * @param {object} note        - the note object ({ title, content, ... })
 * @param {HTMLElement} sourceEl - the DOM node to render (the .note-preview div)
 * @param {(msg: string) => void} [onProgress] - optional status callback
 */
export async function exportAsPdf(note, sourceEl, onProgress) {
  if (!sourceEl) throw new Error('PREVIEW_ELEMENT_NOT_FOUND');

  const title = note?.title || 'Untitled';

  onProgress?.('LOADING_PDF_LIBS…');

  // Lazy-load so the main bundle stays small.
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  onProgress?.('RENDERING…');

  // Clone the node into an off-screen container so we control width and
  // don't get clipped by the on-screen scroll container.
  const clone = sourceEl.cloneNode(true);
  const offscreen = document.createElement('div');
  offscreen.style.position = 'fixed';
  offscreen.style.left = '-10000px';
  offscreen.style.top = '0';
  offscreen.style.width = '780px'; // A4-ish content width at ~96dpi
  offscreen.style.background = getComputedStyle(document.body).backgroundColor || '#ffffff';
  offscreen.style.color = getComputedStyle(document.body).color || '#000000';
  offscreen.style.padding = '24px';
  offscreen.style.fontFamily = getComputedStyle(sourceEl).fontFamily || 'monospace';
  offscreen.style.boxSizing = 'border-box';

  // Force light background for readability in PDF regardless of theme.
  offscreen.setAttribute('data-theme', 'light');
  offscreen.style.background = '#ffffff';
  offscreen.style.color = '#111111';

  // Also apply light theme CSS variables to the clone by wrapping it.
  const themeWrapper = document.createElement('div');
  themeWrapper.setAttribute('data-theme', 'light');
  themeWrapper.style.background = '#ffffff';
  themeWrapper.style.color = '#111111';
  themeWrapper.appendChild(clone);
  offscreen.appendChild(themeWrapper);
  document.body.appendChild(offscreen);

  try {
    onProgress?.('CAPTURING…');

    const canvas = await html2canvas(offscreen, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: offscreen.scrollWidth,
      windowHeight: offscreen.scrollHeight,
    });

    onProgress?.('BUILDING_PDF…');

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 36; // 0.5 inch

    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    // Scale the canvas so its width maps to contentWidth.
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png');

    // Paginate: slice the tall image into page-height chunks.
    let remaining = imgHeight;
    let offsetY = 0;

    while (remaining > 0) {
      const sliceHeight = Math.min(remaining, contentHeight);
      // jsPDF's addImage lets us place the full image with a negative Y offset
      // and clip via a page-sized "window". We do it by adding the full image
      // at (margin, margin - offsetY) and only showing the sliceHeight.
      //
      // To actually clip, we create a temporary canvas for the slice.
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.max(
        1,
        Math.round((sliceHeight / imgHeight) * canvas.height)
      );
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        Math.round((offsetY / imgHeight) * canvas.height),
        canvas.width,
        pageCanvas.height,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      const pageData = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageData, 'PNG', margin, margin, imgWidth, sliceHeight);

      remaining -= sliceHeight;
      offsetY += sliceHeight;

      if (remaining > 0) pdf.addPage();
    }

    // If the canvas was shorter than one page, the loop above already added
    // one page. Good.

    void imgData; // (kept for potential future use)

    pdf.save(`${safeFilename(title)}.pdf`);
    onProgress?.('DONE');
  } finally {
    document.body.removeChild(offscreen);
  }
}