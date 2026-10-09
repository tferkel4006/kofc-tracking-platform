// Sprint 6L Extension 3: the Council Prayer Intentions List - schema 52's CouncilPrayerIntention and its Praying Hands
// counter (CouncilPrayerIntentionPrayer, one tap per member per intention per day) - shown on the web Faith Center page
// and on the phone's Home screen. Also the Marketing Factory's Co-Pilot wording and the feast day widget leaving the
// finance screens.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPrayerIntentionBoard,
  cleanPrayerIntentionText,
  COPILOT_PROMPT_LABEL,
  describePrayerCount,
  FRATERNAL_AREAS,
  mayClosePrayerIntention,
  portalAreas,
  portalSidebar,
  PRAYER_INTENTION_MAX_LENGTH,
  PRAYING_HANDS_LABEL,
  prayerTally,
  RECORD_REFERENCES,
  BusinessRuleError,
  type CouncilPrayerIntention,
  type MemberWriteActor,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const TODAY = '2026-09-20'; // helpers' NOW

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({
  memberId: 20,
  councilId: OWN,
  memberType: 'Member',
  active: true,
  roles: [],
  officer: false,
  ...over,
});

const intention = (over: Partial<CouncilPrayerIntention> = {}): CouncilPrayerIntention => ({
  id: 1,
  council_id: OWN,
  author_member_id: 30,
  intention_text: 'For the sick of our parish.',
  created_at: '2026-09-01 10:00:00',
  closed_at: null,
  closed_by_member_id: null,
  ...over,
});

describe('prayer intention rules', () => {
  it('trims the text, caps it at 500 characters and runs the diary content guard', () => {
    expect(cleanPrayerIntentionText('  For my father.  ')).toBe('For my father.');
    expect(PRAYER_INTENTION_MAX_LENGTH).toBe(500);
    expect(() => cleanPrayerIntentionText('   ')).toThrow(BusinessRuleError);
    expect(() => cleanPrayerIntentionText('x'.repeat(501))).toThrow(/at most 500/);
    expect(() => cleanPrayerIntentionText('what the fuck')).toThrow(BusinessRuleError);
  });

  it('lets the author, officers, Admins and Super Admins close an intention, and no one from another council', () => {
    const i = intention();
    expect(mayClosePrayerIntention(actor({ memberId: 30 }), i)).toBe(true);
    expect(mayClosePrayerIntention(actor(), i)).toBe(false);
    expect(mayClosePrayerIntention(actor({ officer: true }), i)).toBe(true);
    expect(mayClosePrayerIntention(actor({ memberType: 'Admin' }), i)).toBe(true);
    expect(mayClosePrayerIntention(actor({ memberType: 'Super Admin', councilId: 2 }), i)).toBe(true);
    expect(mayClosePrayerIntention(actor({ officer: true, councilId: 2 }), i)).toBe(false);
    expect(mayClosePrayerIntention(actor({ memberId: 30, active: false }), i)).toBe(false);
  });

  it('counts every tap and knows whether the caller prayed today', () => {
    const taps = [
      { intention_id: 1, member_id: 20, prayed_on: '2026-09-19' },
      { intention_id: 1, member_id: 21, prayed_on: TODAY },
      { intention_id: 2, member_id: 20, prayed_on: TODAY },
    ];
    expect(prayerTally(1, taps, 20, TODAY)).toEqual({ intentionId: 1, prayerCount: 2, prayedByMeToday: false });
    expect(prayerTally(2, taps, 20, TODAY)).toEqual({ intentionId: 2, prayerCount: 1, prayedByMeToday: true });
    expect(describePrayerCount(0)).toBe('Be the first to pray for this intention.');
    expect(describePrayerCount(1)).toBe('Prayed for 1 time');
    expect(describePrayerCount(4)).toBe('Prayed for 4 times');
  });

  it('lists only the council\'s open intentions, newest first, with authors', () => {
    const board = buildPrayerIntentionBoard({
      councilId: OWN,
      intentions: [
        intention({ id: 1, created_at: '2026-09-01 10:00:00' }),
        intention({ id: 2, created_at: '2026-09-05 10:00:00' }),
        intention({ id: 3, closed_at: '2026-09-06 10:00:00' }),
        intention({ id: 4, council_id: 2 }),
      ],
      prayers: [],
      members: [{ id: 30, MemberFirstName: 'Paul', MemberLastName: 'Wolf' }],
      actor: actor(),
      today: TODAY,
    });
    expect(board.intentions.map((d) => d.intention.id)).toEqual([2, 1]);
    expect(board.intentions[0]).toMatchObject({ authorFirstName: 'Paul', authorLastName: 'Wolf', prayerCount: 0, prayedByMeToday: false, mayClose: false });
  });
});

describe('schema 52 and the screens', () => {
  it('declares both tables, the one-tap-a-day index and the council delete guard', () => {
    expect(Object.keys(TABLES)).toEqual(expect.arrayContaining(['CouncilPrayerIntention', 'CouncilPrayerIntentionPrayer']));
    expect(read('Schema.sql')).toContain('CREATE UNIQUE INDEX [CouncilPrayerIntentionPrayer_Day_Idx] ON [CouncilPrayerIntentionPrayer] ([intention_id], [member_id], [prayed_on]);');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[2-9]|[6-9]\d);/);
    expect(RECORD_REFERENCES.Council).toContainEqual({ table: 'CouncilPrayerIntention', column: 'council_id', noun: ['prayer intention', 'prayer intentions'] });
  });

  it('gives every member the web Faith Center under Faith In Action, and never a white-label tenant', () => {
    const member = { memberId: 3, councilId: OWN, memberType: 'Member', roles: [], isOfficer: false } as const;
    expect(portalAreas(member)).toContain('faith-center');
    expect(portalSidebar(member).find((g) => g.label === 'Faith In Action')!.entries.map((e) => e.item)).toContain('faith-center');
    expect(FRATERNAL_AREAS).toContain('faith-center');
    expect(portalAreas(member, undefined, 'GENERIC')).not.toContain('faith-center');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'faith-center': { href: '/faith-center', label: 'Faith Center'");
  });

  it('builds the web Faith Center from the feast banner, the daily verse and the prayer list', () => {
    const page = read('apps/web/app/faith-center/page.tsx');
    expect(page).toContain('RequireArea area="faith-center"');
    for (const piece of ['liturgicalBanner(today)', 'dailyVerse(today)', 'NABRE_NOTICE', 'HOLY_DAY_BADGE', 'db.prayers.getBoard(', 'db.prayers.pray(', 'db.prayers.addIntention(', 'PRAYING_HANDS_LABEL']) {
      expect(page).toContain(piece);
    }
    expect(PRAYING_HANDS_LABEL).toBe('[ 🙏 Praying Hands ]');
  });

  it('renders the prayer list with its Praying Hands counters on the phone Home screen', () => {
    const home = read('apps/mobile/app/(app)/index.tsx');
    expect(home).toContain('<PrayerIntentions version={prayerVersion} />');
    const list = read('apps/mobile/components/PrayerIntentions.tsx');
    for (const piece of ['db.prayers.getBoard(', 'db.prayers.pray(', 'db.prayers.addIntention(', 'title={PRAYING_HANDS_LABEL}', 'isFraternalTenant(']) {
      expect(list).toContain(piece);
    }
  });

  it('keeps the finance screens free of the feast day widget', () => {
    for (const page of ['donations/page.tsx', 'finance/dashboard/page.tsx', 'finance/ledger/page.tsx', 'finance/balance-sheet/page.tsx', 'finance/audit/page.tsx']) {
      const source = read(`apps/web/app/${page}`);
      expect(source).not.toMatch(/FaithCenterMirror|liturgicalBanner|dailyVerse/);
    }
  });

  it('names the Co-Pilot after Microsoft and drops GYST from the Marketing Factory', () => {
    expect(COPILOT_PROMPT_LABEL).toBe('🤖 Ask Microsoft Co-Pilot to Design Advanced Collateral');
    for (const path of ['apps/web/components/CopilotPrompt.tsx', 'apps/web/app/resources/marketing/page.tsx', 'apps/web/app/credentials-vault/page.tsx', 'packages/shared/src/copilot.ts']) {
      expect(read(path)).not.toMatch(/GYST/);
    }
  });
});

describe.each(drivers)('prayer intentions ($name driver)', (d) => {
  it('posts, prays once a day per member and lists the counts', async () => {
    const db = await d.make();
    const posted = await db.prayers.addIntention(MEMBER.member, OWN, '  For the soul of Paul Della.  ');
    expect(posted).toMatchObject({ council_id: OWN, author_member_id: MEMBER.member, intention_text: 'For the soul of Paul Della.', closed_at: null });

    expect(await db.prayers.pray(MEMBER.member, posted.id)).toEqual({ intentionId: posted.id, prayerCount: 1, prayedByMeToday: true });
    expect(await db.prayers.pray(MEMBER.member, posted.id)).toEqual({ intentionId: posted.id, prayerCount: 1, prayedByMeToday: true });
    expect(await db.prayers.pray(MEMBER.admin, posted.id)).toEqual({ intentionId: posted.id, prayerCount: 2, prayedByMeToday: true });
    expect(d.count(db, 'CouncilPrayerIntentionPrayer')).toBe(2);

    const board = await db.prayers.getBoard(MEMBER.newMember, OWN);
    const row = board.intentions.find((i) => i.intention.id === posted.id)!;
    expect(row).toMatchObject({ prayerCount: 2, prayedByMeToday: false, mayClose: false });
    expect(board.today).toBe(TODAY);
  });

  it('refuses blank text, other councils and unknown intentions, writing nothing', async () => {
    const db = await d.make();
    await expectRule(db.prayers.addIntention(MEMBER.member, OWN, '  '), 'INVALID_INPUT');
    await expectRule(db.prayers.addIntention(MEMBER.member, 2, 'Not my council'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.prayers.getBoard(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.prayers.pray(MEMBER.member, 9999), 'RECORD_NOT_FOUND');
    expect(d.count(db, 'CouncilPrayerIntention')).toBe(0);
  });

  it('lets the author close an intention, refuses another member, and stops prayers once closed', async () => {
    const db = await d.make();
    const posted = await db.prayers.addIntention(MEMBER.member, OWN, 'For safe travel to the state convention.');
    await expectRule(db.prayers.closeIntention(MEMBER.newMember, posted.id), 'PRAYER_INTENTION_CLOSER_REQUIRED');
    const closed = await db.prayers.closeIntention(MEMBER.member, posted.id);
    expect(closed.closed_at).toBeTruthy();
    expect(closed.closed_by_member_id).toBe(MEMBER.member);
    await expectRule(db.prayers.pray(MEMBER.admin, posted.id), 'PRAYER_INTENTION_CLOSED');
    await expectRule(db.prayers.closeIntention(MEMBER.admin, posted.id), 'PRAYER_INTENTION_CLOSED');
    expect((await db.prayers.getBoard(MEMBER.member, OWN)).intentions).toEqual([]);
  });

  it('refuses a white-label council with FRATERNAL_EXTENSION_REQUIRED', async () => {
    const db = await d.make();
    await db.councils.setGlobalParameters(MEMBER.superAdmin, OWN, { tenant_type: 'GENERIC' });
    await expectRule(db.prayers.getBoard(MEMBER.member, OWN), 'FRATERNAL_EXTENSION_REQUIRED');
    await expectRule(db.prayers.addIntention(MEMBER.member, OWN, 'For peace.'), 'FRATERNAL_EXTENSION_REQUIRED');
  });
});
