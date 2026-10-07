// Sprint 6Z-Page-Generation (Schema 35): the Council Bylaws Data Vault (Council.BylawsMarkdown, councils.setBylaws,
// parseBylaws/bylawsTokenFeed), the docs-as-code SOP Center (parseMarkdown over docs/sop/), the Bulletins board
// (bulletinCards over the Drive link columns) and the Growth & Hours Charts (trailingMonths, membershipGrowth).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BYLAWS_MAX_LENGTH,
  bulletinCards,
  bylawsTokenFeed,
  canEditBylaws,
  cleanBylawsText,
  docTitle,
  driveHref,
  membershipGrowth,
  monthLabel,
  parseBylaws,
  parseInline,
  parseMarkdown,
  portalAreas,
  trailingMonths,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('bylaws clauses', () => {
  const text = 'Adopted 1950.\n\n# Article I - Name\nThe council is named.\n## Section 1 - Seal\nThe seal is round.\n\n\n\nIt is gold.\n## Section 2\n# Article II - Officers\n## Section 1\nThe Grand Knight presides.';

  it('numbers each article and section, keeping the preamble as A0', () => {
    expect(parseBylaws(text).map((c) => [c.id, c.path, c.text])).toEqual([
      ['A0', [], 'Adopted 1950.'],
      ['A1', ['Article I - Name'], 'The council is named.'],
      ['A1.S1', ['Article I - Name', 'Section 1 - Seal'], 'The seal is round.\n\nIt is gold.'],
      ['A1.S2', ['Article I - Name', 'Section 2'], ''],
      ['A2', ['Article II - Officers'], ''],
      ['A2.S1', ['Article II - Officers', 'Section 1'], 'The Grand Knight presides.'],
    ]);
  });

  it('wraps the clauses in the versioned engine feed', () => {
    const feed = bylawsTokenFeed({ id: 7, BylawsMarkdown: text, BylawsUpdatedAt: '2026-10-06T12:00:00.000Z' });
    expect(feed).toMatchObject({ format: 'kofc.bylaws/v1', councilId: 7, updatedAt: '2026-10-06T12:00:00.000Z', clauseCount: 6 });
    expect(feed.wordCount).toBe(feed.clauses.reduce((n, c) => n + c.wordCount, 0));
    expect(bylawsTokenFeed({ id: 7 })).toMatchObject({ clauseCount: 0, wordCount: 0, updatedAt: null });
  });

  it('trims the stored text, allows clearing it, and caps its length', () => {
    expect(cleanBylawsText('  # A  \n')).toBe('# A');
    expect(cleanBylawsText('')).toBe('');
    expect(() => cleanBylawsText('x'.repeat(BYLAWS_MAX_LENGTH + 1))).toThrow(/at most/);
    expect(() => cleanBylawsText(42)).toThrow(/must be text/);
  });

  it("gives the Edit button to the council's meeting keepers only", () => {
    const base = { memberId: 9, councilId: 1, isOfficer: false } as const;
    expect(canEditBylaws({ ...base, memberType: 'Member' }, 1)).toBe(false);
    expect(canEditBylaws({ ...base, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] }, 1)).toBe(true);
    expect(canEditBylaws({ ...base, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] }, 2)).toBe(false);
    expect(canEditBylaws({ ...base, memberType: 'Admin' }, 1)).toBe(true);
    expect(canEditBylaws({ ...base, memberType: 'Super Admin' }, 2)).toBe(true);
    expect(portalAreas({ ...base, memberType: 'Member' })).toContain('governance/bylaws');
  });
});

describe('schema 35', () => {
  it('adds the two council columns and bumps the phone database', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Council\] ADD \[BylawsMarkdown\] VARCHAR\(MAX\) NULL;/);
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Council\] ADD \[BylawsUpdatedAt\] DATETIME NULL;/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 35;/);
    expect(read('data_dictionary.md')).toContain('BylawsMarkdown (VARCHAR(MAX), NULL)');
  });
});

describe.each(drivers)('$name driver: councils.setBylaws', (d) => {
  it('starts empty, then saves, stamps and clears the bylaws', async () => {
    const db = await d.make();
    expect((await db.councils.get(1))?.BylawsMarkdown ?? null).toBeNull();
    const saved = await db.councils.setBylaws(MEMBER.admin, 1, '  # Article I\nText.  ');
    expect(saved.BylawsMarkdown).toBe('# Article I\nText.');
    expect(saved.BylawsUpdatedAt).toBeTruthy();
    expect((await db.councils.get(1))?.BylawsMarkdown).toBe('# Article I\nText.');
    expect((await db.councils.setBylaws(MEMBER.superAdmin, 1, '')).BylawsMarkdown).toBe('');
  });

  it('refuses a plain member and an unknown council, writing nothing', async () => {
    const db = await d.make();
    await expectRule(db.councils.setBylaws(MEMBER.member, 1, '# Mine'), 'ADMIN_REQUIRED');
    expect((await db.councils.get(1))?.BylawsMarkdown ?? null).toBeNull();
    await expectRule(db.councils.setBylaws(MEMBER.superAdmin, 999, '# X'), 'RECORD_NOT_FOUND');
    await expectRule(db.councils.setBylaws(MEMBER.admin, 1, 'x'.repeat(BYLAWS_MAX_LENGTH + 1)), 'INVALID_INPUT');
  });

  it('keeps councils.update from touching the bylaws', async () => {
    const db = await d.make();
    await db.councils.setBylaws(MEMBER.admin, 1, '# Kept');
    await db.councils.update(MEMBER.superAdmin, 1, { Phone: '555-0100' });
    expect((await db.councils.get(1))?.BylawsMarkdown).toBe('# Kept');
  });
});

describe('docs-as-code markdown', () => {
  it('splits a document into headings, lists, quotes, tables and code', () => {
    const md = [
      '# Title',
      '',
      '> **Who can do this:** Admins.',
      '> **Warning:** no undo.',
      '',
      '1. Open the page.',
      '2. Select **Save**.',
      '',
      '- [ ] Check one',
      '- plain',
      '',
      '| Problem | Fix |',
      '| --- | --- |',
      '| A | B |',
      '',
      '```',
      'npm run build:web',
      '```',
      '---',
      'A closing line',
      'that wraps.',
    ].join('\n');
    expect(parseMarkdown(md)).toEqual([
      { kind: 'heading', level: 1, text: 'Title' },
      { kind: 'quote', text: '**Who can do this:** Admins.\n**Warning:** no undo.' },
      { kind: 'list', ordered: true, items: ['Open the page.', 'Select **Save**.'] },
      { kind: 'list', ordered: false, items: ['[ ] Check one', 'plain'] },
      { kind: 'table', head: ['Problem', 'Fix'], rows: [['A', 'B']] },
      { kind: 'code', text: 'npm run build:web' },
      { kind: 'rule' },
      { kind: 'paragraph', text: 'A closing line that wraps.' },
    ]);
  });

  it('drops KEEP_IMAGE guards but keeps the https image between them', () => {
    const md = '<!-- KEEP_IMAGE: console -->\n![The console](https://example.org/c.png)\n<!-- /KEEP_IMAGE -->';
    expect(parseMarkdown(md)).toEqual([{ kind: 'image', alt: 'The console', src: 'https://example.org/c.png' }]);
    expect(parseMarkdown('![Local](../generated/x.png)')).toEqual([{ kind: 'paragraph', text: '[Image: Local]' }]);
  });

  it('styles inline text and never links to an unsafe target', () => {
    expect(parseInline('Select **Save**, then *wait* for `ok` and [help](/help).')).toEqual([
      { kind: 'text', text: 'Select ' },
      { kind: 'bold', text: 'Save' },
      { kind: 'text', text: ', then ' },
      { kind: 'italic', text: 'wait' },
      { kind: 'text', text: ' for ' },
      { kind: 'code', text: 'ok' },
      { kind: 'text', text: ' and ' },
      { kind: 'link', text: 'help', href: '/help' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseInline('[x](javascript:alert(1))')[0]).toEqual({ kind: 'text', text: 'x' });
    expect(parseInline('[x](//evil.example)')[0]).toEqual({ kind: 'text', text: 'x' });
  });

  it('titles a document by its first heading, else its file name', () => {
    expect(docTitle('edit-bylaws', '# Edit the bylaws\n## Steps')).toBe('Edit the bylaws');
    expect(docTitle('record_a-vote', 'No heading')).toBe('Record a vote');
  });

  it('publishes every SOP in docs/sop with a title and the five workflow headings', () => {
    const dir = join(root, 'docs', 'sop');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const md = readFileSync(join(dir, f), 'utf8');
      expect(parseMarkdown(md)[0]).toMatchObject({ kind: 'heading', level: 1 });
      for (const h of ['**Who can do this:**', '**Goal:**', '**Start point:**', '**Steps:**', '**Expected result:**', '**Common problems:**']) expect(md).toContain(h);
    }
  });
});

describe('bulletins board', () => {
  it('turns Drive ids and Drive links into cards, newest first, and skips everything else', () => {
    const cards = bulletinCards(
      [
        { id: 1, 'Meeting Name': 'October meeting', Date: '2026-10-06', GoogleDriveFlyerURL: 'https://drive.google.com/file/d/abc/view', GoogleDriveMinutesURL: null, MinutesURL: DRIVE_ID },
        { id: 2, 'Meeting Name': 'September meeting', Date: '2026-09-01', GoogleDriveFlyerURL: 'blob:local', GoogleDriveMinutesURL: null, MinutesURL: '' },
      ],
      [{ id: 5, EventName: 'Fish fry', StartDate: '2026-09-20', PhotoGalleryURL: DRIVE_ID }],
    );
    expect(cards.map((c) => [c.kind, c.title, c.date])).toEqual([
      ['Flyer', 'October meeting', '2026-10-06'],
      ['Minutes', 'October meeting', '2026-10-06'],
      ['Photo album', 'Fish fry', '2026-09-20'],
    ]);
    expect(cards[1].href).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/view`);
    expect(driveHref('https://docs.google.com/document/d/x')).toBe('https://docs.google.com/document/d/x');
    expect(driveHref('https://example.org/x')).toBeNull();
  });
});

describe('growth and hours charts', () => {
  it('lays out the trailing months across a year boundary', () => {
    const months = trailingMonths({ year: 2026, month: 2 }, 4);
    expect(months).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(monthLabel(months[0])).toBe('Nov 2025');
  });

  it('counts joins per month and the dated roster at each month end', () => {
    const months = trailingMonths({ year: 2026, month: 3 }, 3);
    const growth = membershipGrowth(
      [{ DateJoinedCouncil: '2020-05-01' }, { DateJoinedCouncil: '2026-02-10' }, { DateJoinedCouncil: '2026-02-28' }, { DateJoinedCouncil: '2026-03-01' }, { DateJoinedCouncil: null }],
      months,
    );
    expect(growth.points.map((p) => [p.month, p.joined, p.rosterSize])).toEqual([
      [1, 0, 1],
      [2, 2, 3],
      [3, 1, 4],
    ]);
    expect(growth.undated).toBe(1);
  });
});
