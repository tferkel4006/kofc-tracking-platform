// Sprint 6B (Phase 4): the AI Fraternal & Constitutional Advisor - adviseQuery's two tiers (council bylaws, then the
// baseline rules), its Source Authority lines, the PARLIAMENTARY COMPLIANCE WARNING patterns, and the terminal page.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADVISOR_BASELINE_RULES,
  ADVISOR_EXCERPT_MAX_LENGTH,
  adviseQuery,
  advisorKeywords,
  AGENDA_NOTICE_DAYS,
  bylawsTokenFeed,
  clauseExcerpt,
  COMPLIANCE_WARNING_TITLE,
  complianceWarnings,
  PORTAL_NAV_GROUPS,
  portalAreas,
} from '@kofc/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const BYLAWS = `# Article I - Meetings
## Section 1 - Regular meetings
The council meets on the second Tuesday of each month at 7:30 PM.
## Section 2 - Quorum
Fifteen members in good standing constitute a quorum for regular meetings.
# Article II - Finances
## Section 1 - Expenditures
Any expenditure over $500 requires a two-thirds vote of the members present.
## Section 2
`;

const feed = bylawsTokenFeed({ id: 1, BylawsMarkdown: BYLAWS });
const empty = bylawsTokenFeed({ id: 1, BylawsMarkdown: '' });

describe('adviseQuery tier 1 - council bylaws', () => {
  it('answers from the best-matching clause and cites its id and headings', () => {
    const r = adviseQuery(feed, 'How many members make a quorum?');
    expect(r).toMatchObject({ tier: 'bylaws', fallbackReason: null, warnings: [] });
    expect(r.answer).toBe('Fifteen members in good standing constitute a quorum for regular meetings.');
    expect(r.authority).toBe('Council Bylaws, clause A1.S2 - Article I - Meetings › Section 2 - Quorum');
    expect(r.clauseIds[0]).toBe('A1.S2');
  });

  it('opens a clause cited by id, in either case', () => {
    expect(adviseQuery(feed, 'What does A2.S1 say?')).toMatchObject({ tier: 'bylaws', clauseIds: ['A2.S1'] });
    expect(adviseQuery(feed, 'read a1.s1').authority).toContain('clause A1.S1');
  });

  it('falls back to the baseline when no clause matches, or the cited clause is empty', () => {
    expect(adviseQuery(feed, 'Can we lay a motion on the table?')).toMatchObject({ tier: 'baseline', fallbackReason: 'no-match' });
    expect(adviseQuery(feed, 'A2.S2 secret ballot')).toMatchObject({ tier: 'baseline', fallbackReason: 'no-match' });
  });

  it('cuts a long clause at a word', () => {
    const long = 'word '.repeat(400);
    const cut = clauseExcerpt(long);
    expect(cut.length).toBeLessThanOrEqual(ADVISOR_EXCERPT_MAX_LENGTH + 2);
    expect(cut.endsWith(' …')).toBe(true);
    expect(clauseExcerpt('Short\n\n text.')).toBe('Short text.');
  });
});

describe('adviseQuery tier 2 - baseline rules', () => {
  it('answers from the baseline when the vault is empty', () => {
    const r = adviseQuery(empty, 'How many members make a quorum?');
    expect(r).toMatchObject({ tier: 'baseline', fallbackReason: 'empty', clauseIds: [] });
    expect(r.answer).toMatch(/quorum/i);
    expect(r.authority).toMatch(/^Standard parliamentary law/);
  });

  it('reads the hand-vote and 10-day rules from the platform', () => {
    expect(adviseQuery(empty, 'How does the Recorder take a manual hand vote?').authority).toContain('hand-vote console');
    expect(adviseQuery(empty, 'How many days notice does a motion need?').answer).toContain(`${AGENDA_NOTICE_DAYS} calendar days`);
    expect(adviseQuery(empty, 'Does a tie pass?').answer).toContain('A tie fails');
  });

  it('says so when no baseline rule covers the question', () => {
    expect(adviseQuery(empty, 'zebra').authority).toContain('no matching rule');
    expect(adviseQuery(empty, '   ').tier).toBe('baseline');
  });

  it('gives every baseline rule an answer and a Source Authority', () => {
    for (const rule of ADVISOR_BASELINE_RULES) {
      expect(rule.answer.length, rule.id).toBeGreaterThan(40);
      expect(rule.authority.length, rule.id).toBeGreaterThan(10);
    }
  });

  it('drops stopwords and plural endings from the keywords', () => {
    expect(advisorKeywords('What are the Ballots of the Council?')).toEqual(['ballot']);
  });
});

describe('compliance warnings', () => {
  it.each([
    ['Can an absent brother vote by proxy?', /Proxy voting/],
    ['Can we vote without a quorum tonight?', /without a quorum is void/],
    ['Can guests vote on the motion?', /Only members/],
    ['How can I find out who voted against me?', /secret ballot stays secret/],
    ['Can the treasurer pay the hall without a council vote?', /may not be spent/],
    ['Can the Grand Knight change the vote result?', /result stands/],
    ['Let us suspend the bylaws for this meeting', /cannot be suspended/],
    ['Can I vote twice on this motion?', /one vote on each question/],
  ])('flags %s', (q, text) => {
    const warnings = complianceWarnings(q);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].title).toBe(COMPLIANCE_WARNING_TITLE);
    expect(warnings.map((w) => w.text).join(' ')).toMatch(text);
    expect(adviseQuery(feed, q).warnings).toEqual(warnings);
  });

  it.each(['What is a quorum?', 'How do we amend the bylaws by a two-thirds vote?', 'Can we table a motion?', 'How does a secret ballot work?'])(
    'does not flag the ordinary question %s',
    (q) => expect(complianceWarnings(q)).toEqual([]),
  );
});

describe('advisor terminal page', () => {
  it('is an officer tool (Sprint 6L Extension) and sits under Governance after the bylaws', () => {
    expect(portalAreas({ memberId: 9, councilId: 1, isOfficer: false, memberType: 'Member' })).not.toContain('governance/advisor');
    expect(portalAreas({ memberId: 9, councilId: 1, isOfficer: true, memberType: 'Member' })).toContain('governance/advisor');
    expect(portalAreas({ memberId: 9, councilId: 1, isOfficer: false, memberType: 'Super Admin' })).toContain('governance/advisor');
    const governance = PORTAL_NAV_GROUPS.find((g) => g.id === 'governance')!.items;
    expect(governance.indexOf('governance/advisor')).toBe(governance.indexOf('governance/bylaws') + 1);
    expect(read('apps/web/components/Sidebar.tsx')).toContain("href: '/governance/advisor'");
  });

  it('titles the terminal, shows Source Authority and the warning box, and reads the bylaws feed', () => {
    const page = read('apps/web/app/governance/advisor/page.tsx');
    expect(page).toContain('AI Fraternal &amp; Constitutional Advisor');
    expect(page).toContain('Source Authority:');
    expect(page).toContain('PARLIAMENTARY COMPLIANCE WARNING');
    expect(page).toContain('role="alert"');
    expect(page).toContain('bylawsTokenFeed(row)');
    expect(page).toContain('<RequireArea area="governance/advisor">');
    expect(page).not.toContain('font-mono');
  });
});
