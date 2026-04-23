const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Tiny markdown-to-HTML for the daily case section. Supports:
 *   - ## Headings → <h3>
 *   - Numbered lists (1. 2. 3.) → <ol><li>
 *   - Unordered lists (- or *) → <ul><li>
 *   - **bold** inline
 *   - Blank-line separated paragraphs → <p>
 * Intentionally minimal — keeps us library-free.
 */
export function caseMarkdownToHtml(md: string): string {
  const normalized = md.replace(/\r\n/g, '\n').trim();
  const blocks = normalized.split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      const [headingLine, ...rest] = trimmed.split('\n');
      html.push(`<h3>${renderInline(headingLine.slice(3).trim())}</h3>`);
      const remainder = rest.join('\n').trim();
      if (remainder) {
        // Recursively handle whatever follows the heading so lists / paragraphs
        // that weren't blank-line separated from the heading still render.
        html.push(caseMarkdownToHtml(remainder));
      }
      continue;
    }

    const lines = trimmed.split('\n');
    const isOrdered = lines.every((line) => /^\d+\.\s+/.test(line));
    if (isOrdered) {
      const items = lines
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join('');
      html.push(`<ol>${items}</ol>`);
      continue;
    }

    const isUnordered = lines.every((line) => /^[-*]\s+/.test(line));
    if (isUnordered) {
      const items = lines
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .map((item) => `<li>${renderInline(item)}</li>`)
        .join('');
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    html.push(`<p>${renderInline(trimmed.replace(/\n/g, ' '))}</p>`);
  }

  return html.join('\n');
}
