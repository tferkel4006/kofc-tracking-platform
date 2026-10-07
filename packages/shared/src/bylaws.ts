// =========================================================================
// COUNCIL BYLAWS DATA VAULT (Sprint 6Z, Schema 35)
// Council.BylawsMarkdown holds the council's own bylaws as light markdown: '# ' starts an article, '## ' (or deeper)
// a section, and every other line is clause text. Every member of the council reads them (/governance/bylaws); the
// council's meeting keepers - an Active Admin or Grand Knight of the council, or any Active Super Admin - edit them
// (councils.setBylaws). Council.BylawsUpdatedAt stamps the last save.
//
// parseBylaws splits the text into numbered clauses and bylawsTokenFeed wraps them in a stable JSON shape, so the
// parliamentary engines of Phase 4 can cite a clause by its id ('A2.S3') without parsing markdown themselves.
// =========================================================================
import { assertText } from './rules';

/** The longest bylaws text the vault stores (characters, after trimming). */
export const BYLAWS_MAX_LENGTH = 100_000;

/** The bylaws text to store, trimmed; '' clears the vault. Rejects INVALID_INPUT past BYLAWS_MAX_LENGTH. */
export const cleanBylawsText = (value: unknown): string => assertText(value, 'Bylaws', BYLAWS_MAX_LENGTH, false);

/** One clause of the bylaws: the text under one heading. */
export interface BylawsClause {
  /** 'A2' for the second article's preamble, 'A2.S3' for its third section; 'A0' is text before the first article. */
  id: string;
  article: number;
  /** 0 for text directly under the article heading. */
  section: number;
  /** The article heading, then the section heading when there is one. */
  path: string[];
  /** The clause text, its lines joined with '\n' and blank lines collapsed. */
  text: string;
  wordCount: number;
}

const HEADING = /^(#{1,6})\s+(.*)$/;

/** Splits bylaws markdown into clauses in document order. Headings with no text under them are kept, as empty clauses. */
export function parseBylaws(markdown: string): BylawsClause[] {
  const clauses: BylawsClause[] = [];
  let article = 0;
  let section = 0;
  let articleTitle = '';
  let current: { article: number; section: number; path: string[]; lines: string[] } | null = null;
  const close = () => {
    if (!current) return;
    const text = current.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text !== '' || current.path.length > 0) {
      clauses.push({
        id: current.section > 0 ? `A${current.article}.S${current.section}` : `A${current.article}`,
        article: current.article,
        section: current.section,
        path: current.path,
        text,
        wordCount: text === '' ? 0 : text.split(/\s+/).length,
      });
    }
    current = null;
  };
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = HEADING.exec(raw.trim());
    if (heading) {
      close();
      const title = heading[2].trim();
      if (heading[1].length === 1) {
        article += 1;
        section = 0;
        articleTitle = title;
        current = { article, section, path: [title], lines: [] };
      } else {
        section += 1;
        current = { article, section, path: article > 0 ? [articleTitle, title] : [title], lines: [] };
      }
      continue;
    }
    if (!current) current = { article, section, path: [], lines: [] };
    current.lines.push(raw.trimEnd());
  }
  close();
  return clauses;
}

/** The bylaws as the parliamentary engines take them (Sprint 6Z): a versioned, self-describing clause list. */
export interface BylawsTokenFeed {
  format: 'kofc.bylaws/v1';
  councilId: number;
  updatedAt: string | null;
  clauseCount: number;
  wordCount: number;
  clauses: BylawsClause[];
}

export function bylawsTokenFeed(council: { id: number; BylawsMarkdown?: string | null; BylawsUpdatedAt?: string | null }): BylawsTokenFeed {
  const clauses = parseBylaws(council.BylawsMarkdown ?? '');
  return {
    format: 'kofc.bylaws/v1',
    councilId: council.id,
    updatedAt: council.BylawsUpdatedAt ?? null,
    clauseCount: clauses.length,
    wordCount: clauses.reduce((sum, c) => sum + c.wordCount, 0),
    clauses,
  };
}
