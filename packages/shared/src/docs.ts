// =========================================================================
// DOCS-AS-CODE (Sprint 6Z)
// The SOP Center (/answers/sop) renders the markdown files of docs/sop/ - one standard operating procedure per file -
// and the Council Bylaws Data Vault previews the council's bylaws with the same reader. parseMarkdown turns light
// markdown into plain blocks the portal draws as React elements, never as raw HTML, so a document cannot inject markup.
//
// Supported: '#'-'######' headings, paragraphs, '-'/'*' and '1.' lists ('- [ ]' checklist items keep their box),
// '>' quotes, '|' tables, fenced code, '---' rules, https images, and inline **bold**, *italic*, `code` and
// [links](https://...). HTML comments - the <!-- KEEP_IMAGE --> guards of the technical-writer skill - are dropped.
// =========================================================================

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'code'; text: string }
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'rule' };

const SAFE_URL = /^(https:\/\/|mailto:|\/(?!\/)|#)/i;

/** True for a link or image target the portal may follow: https, mailto, a site path or an in-page anchor. */
export const isSafeDocUrl = (url: string): boolean => SAFE_URL.test(url.trim());

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*]+)\*|_([^_]+)_/g;

/** Splits one line of markdown into styled segments. A link to an unsafe target stays plain text. */
export function parseInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'code', text: m[2] });
    else if (m[3] !== undefined) out.push(isSafeDocUrl(m[4]) ? { kind: 'link', text: m[3], href: m[4] } : { kind: 'text', text: m[3] });
    else out.push({ kind: 'italic', text: m[5] ?? m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

const tableCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

/** Splits markdown into blocks in document order. */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      i += 1;
      continue;
    }
    if (trimmed.startsWith('```')) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i += 1;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      if (isSafeDocUrl(image[2])) blocks.push({ kind: 'image', alt: image[1], src: image[2] });
      else blocks.push({ kind: 'paragraph', text: `[Image: ${image[1] || image[2]}]` });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) body.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: body.join('\n') });
      continue;
    }
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = tableCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(tableCells(lines[i++]));
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      const items: string[] = [];
      while (i < lines.length) {
        const next = LIST_ITEM.exec(lines[i]);
        if (next && (next[2] !== undefined) === ordered) {
          items.push(next[3].trim());
          i += 1;
        } else if (lines[i].trim() !== '' && /^\s{2,}/.test(lines[i]) && items.length > 0) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || /^(#{1,6}\s|```|>|\||!\[)/.test(t) || LIST_ITEM.test(lines[i])) break;
      body.push(t);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}

/** One document of a docs-as-code folder: its file name without '.md', its title and its markdown. */
export interface DocFile {
  slug: string;
  title: string;
  markdown: string;
}

/** A document's title: its first '# ' heading, else its file name in words. */
export function docTitle(slug: string, markdown: string): string {
  const h1 = /^#\s+(.+)$/m.exec(markdown.replace(/\r\n?/g, '\n'));
  if (h1) return h1[1].trim();
  return slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
