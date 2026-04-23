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

type LineKind = 'ul' | 'ol' | 'p';
function lineKind(line: string): LineKind {
  if (/^[-*]\s+/.test(line)) return 'ul';
  if (/^\d+\.\s+/.test(line)) return 'ol';
  return 'p';
}

function renderUl(lines: string[]): string {
  let hasTasks = false;
  const items = lines
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .map((raw) => {
      const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        hasTasks = true;
        const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
        return `<li class="task"><input type="checkbox" disabled${checked} />${renderInline(task[2])}</li>`;
      }
      return `<li>${renderInline(raw)}</li>`;
    })
    .join('');
  const cls = hasTasks ? ' class="task-list"' : '';
  return `<ul${cls}>${items}</ul>`;
}

function renderOl(lines: string[]): string {
  const items = lines
    .map((line) => line.replace(/^\d+\.\s+/, '').trim())
    .map((item) => `<li>${renderInline(item)}</li>`)
    .join('');
  return `<ol>${items}</ol>`;
}

function renderParagraph(lines: string[]): string {
  return `<p>${renderInline(lines.join(' '))}</p>`;
}

/**
 * Tiny markdown-to-HTML for the daily case section. Supports:
 *   - ## Headings → <h3>
 *   - Numbered lists (1. 2. 3.) → <ol><li>
 *   - Unordered lists (- or *) → <ul><li>
 *   - Task list items (- [ ] foo / - [x] foo) → <li class="task">
 *   - **bold** inline
 *   - Paragraphs
 *
 * Within a single block (no blank line), consecutive lines are grouped by
 * type so a mix like "opening sentence + bullets + closing 要点 line"
 * renders as <p>...</p><ul>...</ul><p>...</p>, not as one smushed <p>.
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

    // Group consecutive lines by type. A block can mix paragraphs, ul, ol —
    // each contiguous run becomes its own element.
    const lines = trimmed.split('\n');
    type Group = { kind: LineKind; lines: string[] };
    const groups: Group[] = [];
    for (const line of lines) {
      const kind = lineKind(line);
      const last = groups[groups.length - 1];
      if (last && last.kind === kind) {
        last.lines.push(line);
      } else {
        groups.push({ kind, lines: [line] });
      }
    }

    for (const g of groups) {
      if (g.kind === 'ul') html.push(renderUl(g.lines));
      else if (g.kind === 'ol') html.push(renderOl(g.lines));
      else html.push(renderParagraph(g.lines));
    }
  }

  return html.join('\n');
}
