// Sprint 6A (Phase 4): the Interactive Help Desk (parseGuideTasks, searchGuideTasks and phoneTarget over
// docs/MEMBER_USER_GUIDE.md) and the SOP Center's high-contrast reader.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { guideSearchTerms, parseGuideTasks, phoneTarget, plainDocText, portalAreas, searchGuideTasks } from '@kofc/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const SAMPLE = [
  '# Guide',
  '',
  '## 1. About',
  '',
  '### 1.1 Phone tabs',
  '',
  'The phone has five tabs.',
  '',
  '## 2. Hours',
  '',
  '### Concept: the 15-minute rule',
  '',
  '**Goal:** not a task heading.',
  '',
  '### 2.1 Log hours on the phone',
  '',
  '> **Who can do this:** any member on the council roster.',
  '',
  '**Goal:** Record your time.',
  '',
  '**Start point:** Phone app → **Report** tab → **Activities** sub-tab.',
  '',
  '**Steps:**',
  '1. Tap an activity.',
  '2. Slide the bar',
  '   to the right.',
  '<!-- KEEP_IMAGE: grid -->',
  '![Grid](../generated/mobile_app_catalog/grid.png)',
  '<!-- /KEEP_IMAGE -->',
  '3. Tap **Save**.',
  '',
  '**Expected result:** The total shows',
  'on the card.',
  '',
  '**Common problems:**',
  '',
  '| Problem | Cause | Fix |',
  '| --- | --- | --- |',
  '| The grid is empty. | No activity is set up. | Ask an Admin to add one. |',
  '',
  '### 2.2 Log hours in the web portal',
  '',
  '**Goal:** Record your time on a computer.',
  '',
  '**Start point:** Sidebar → Faith In Action → **Member Actions Hub** → **Hour ledger** tab.',
  '',
  '**Steps:**',
  '1. Select **Log hours**.',
  '',
  '**Expected result:** The row shows.',
].join('\r\n');

describe('parseGuideTasks', () => {
  const tasks = parseGuideTasks(SAMPLE);

  it('keeps only numbered headings with a Goal line, in document order', () => {
    expect(tasks.map((t) => [t.id, t.title, t.chapter])).toEqual([
      ['2.1', 'Log hours on the phone', '2. Hours'],
      ['2.2', 'Log hours in the web portal', '2. Hours'],
    ]);
  });

  it('lifts the five parts and the role line out of a task', () => {
    expect(tasks[0]).toEqual({
      id: '2.1',
      title: 'Log hours on the phone',
      chapter: '2. Hours',
      who: 'any member on the council roster.',
      goal: 'Record your time.',
      startPoint: 'Phone app → **Report** tab → **Activities** sub-tab.',
      steps: ['Tap an activity.', 'Slide the bar to the right.', 'Tap **Save**.'],
      expected: 'The total shows on the card.',
      problems: [{ problem: 'The grid is empty.', cause: 'No activity is set up.', fix: 'Ask an Admin to add one.' }],
    });
    expect(tasks[1].problems).toEqual([]);
    expect(tasks[1].who).toBe('');
  });

  it('parses every task of the real member user guide with all five parts', () => {
    const real = parseGuideTasks(read('docs/MEMBER_USER_GUIDE.md'));
    expect(real.length).toBeGreaterThanOrEqual(30);
    expect(new Set(real.map((t) => t.id)).size).toBe(real.length);
    for (const t of real) {
      expect(t.goal, t.id).not.toBe('');
      expect(t.startPoint, t.id).not.toBe('');
      expect(t.steps.length, t.id).toBeGreaterThan(0);
      expect(t.expected, t.id).not.toBe('');
    }
    expect(real.filter((t) => t.problems.length > 0).length).toBeGreaterThan(real.length / 2);
  });
});

describe('searchGuideTasks', () => {
  const real = parseGuideTasks(read('docs/MEMBER_USER_GUIDE.md'));
  const top = (q: string) => searchGuideTasks(real, q)[0]?.title;

  it('drops filler words and short fragments from a query', () => {
    expect(guideSearchTerms('How do I reset my password?')).toEqual(['reset', 'password']);
    expect(guideSearchTerms('  the a ')).toEqual([]);
  });

  it('matches nothing for an empty or filler-only query', () => {
    expect(searchGuideTasks(real, '')).toEqual([]);
    expect(searchGuideTasks(real, 'how do I')).toEqual([]);
  });

  it('puts the task named by the keywords first', () => {
    expect(top('reset forgotten password')).toBe('Reset a forgotten password');
    expect(top('resubmit returned report')).toBe('Fix and resubmit a returned report');
    expect(top('large text')).toBe('Turn on Large Text Layout Mode');
    expect(top('physical item donation')).toBe('Record a physical item donation');
  });

  it('matches word starts, so a stem finds the whole word', () => {
    expect(searchGuideTasks(parseGuideTasks(SAMPLE), 'activit').map((t) => t.id)).toEqual(['2.1']);
  });

  it('ranks a task matching every keyword above one matching fewer', () => {
    expect(searchGuideTasks(parseGuideTasks(SAMPLE), 'hours portal').map((t) => t.id)).toEqual(['2.2', '2.1']);
  });

  it('finds every starter search of the help desk', () => {
    const page = read('apps/web/app/answers/help/HelpDesk.tsx');
    const list = /const SUGGESTIONS = \[([^\]]+)\]/.exec(page)?.[1] ?? '';
    const starters = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(starters.length).toBeGreaterThan(3);
    for (const s of starters) expect(searchGuideTasks(real, s).length, s).toBeGreaterThan(0);
  });
});

describe('phoneTarget', () => {
  it('reads the bottom tab and the path in from a phone start point', () => {
    expect(phoneTarget('Phone app → **Report** tab → **Activities** sub-tab.')).toEqual({ tab: 'Report', trail: ['Report tab', 'Activities sub-tab'] });
    expect(phoneTarget('Phone app → **Mtgs** tab → **My Invites**.')).toEqual({ tab: 'Mtgs', trail: ['Mtgs tab', 'My Invites'] });
  });

  it('keeps the phone part when the start point also names the web portal', () => {
    expect(phoneTarget('Phone app → **Home** → **My shifts**. Web portal → Faith In Action → **Member Actions Hub**.')).toEqual({
      tab: 'Home',
      trail: ['Home', 'My shifts'],
    });
  });

  it('gives no tab for header and sign-in screens', () => {
    expect(phoneTarget('Phone app → your name in the header → **Settings**.')).toEqual({ tab: null, trail: ['your name in the header', 'Settings'] });
    expect(phoneTarget('Phone app → **Welcome. What is your email address?**')?.tab).toBeNull();
  });

  it('returns null for a portal-only or outside start point', () => {
    expect(phoneTarget('Sidebar → Finances → **My Expense Reports**.')).toBeNull();
    expect(phoneTarget('Your welcome email, or the printed codes below.')).toBeNull();
  });

  it('drops inline markers to plain words', () => {
    expect(plainDocText('Tap **Save** and `Enter`, see [docs](https://example.org).')).toBe('Tap Save and Enter, see docs.');
  });
});

describe('help desk and SOP Center pages', () => {
  it('opens the help desk to every signed-in member', () => {
    expect(portalAreas({ memberId: 9, councilId: 1, isOfficer: false, memberType: 'Member' })).toContain('answers/help');
  });

  it('reads the member user guide at build time', () => {
    const page = read('apps/web/app/answers/help/page.tsx');
    expect(page).toContain("readDocsFile('MEMBER_USER_GUIDE.md')");
    expect(page).toContain('parseGuideTasks');
    expect(read('apps/web/app/answers/help/HelpDesk.tsx')).toContain('Interactive Help Desk');
  });

  it('publishes every markdown file of docs/sop/ in the high-contrast reader', () => {
    expect(read('apps/web/app/answers/sop/page.tsx')).toContain("readDocsFolder('sop')");
    const reader = read('apps/web/app/answers/sop/SopCenter.tsx');
    expect(reader).toContain('tone="contrast"');
    expect(reader).toMatch(/bg-black/);
    expect(readdirSync(join(root, 'docs/sop')).filter((n) => n.endsWith('.md')).length).toBeGreaterThan(0);
  });
});
