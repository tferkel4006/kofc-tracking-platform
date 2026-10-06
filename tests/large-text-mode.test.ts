// Sprint 6C: Large Text Layout Mode (Schema 34) - Member.flag_large_text_mode, the member's own switch on the web
// profile and the phone settings screen, and the phone's large text layout tokens (layoutTokens).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BRAND,
  contrastRatio,
  HIGH_CONTRAST,
  LARGE_TEXT_BORDER_WIDTH,
  LARGE_TEXT_MIN_FONT_SIZE,
  LARGE_TEXT_TOGGLE_LABEL,
  LARGE_TEXT_TOUCH_TARGET,
  layoutTokens,
  MEMBER_SELF_SERVICE_COLUMNS,
  prefersLargeText,
  SecurityPrivilegeError,
  SPACING,
  TOUCH_TARGET,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('large text layout tokens', () => {
  it('leaves the standard layout exactly as the brand defines it', () => {
    const t = layoutTokens(false);
    expect(t.large).toBe(false);
    expect(t.color).toMatchObject(BRAND);
    expect(t.color.text).toBe(BRAND.navy);
    expect(t.color.edge).toBe(BRAND.navy);
    expect(t.space).toEqual(SPACING);
    expect(t.touchTarget).toBe(TOUCH_TARGET);
    expect([t.font(13), t.font(16), t.font(24)]).toEqual([13, 16, 24]);
    expect(t.border(1)).toBe(1);
  });

  it('scales body text to 24 points and headings to 36, with no caption below the floor', () => {
    const t = layoutTokens(true);
    expect(t.font(16)).toBe(24);
    expect(t.font(24)).toBe(36);
    expect(t.font(17)).toBeGreaterThan(t.font(16));
    expect(t.font(11)).toBe(LARGE_TEXT_MIN_FONT_SIZE);
    for (const size of [11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 28, 30]) expect(t.font(size)).toBeGreaterThan(size);
  });

  it('makes every tap area at least 140 points tall and doubles the padding', () => {
    const t = layoutTokens(true);
    expect(LARGE_TEXT_TOUCH_TARGET).toBeGreaterThanOrEqual(140);
    expect(t.touchTarget).toBe(LARGE_TEXT_TOUCH_TARGET);
    for (const key of Object.keys(SPACING) as (keyof typeof SPACING)[]) expect(t.space[key]).toBe(SPACING[key] * 2);
  });

  it('draws thick gold borders on a pitch-black background with white type', () => {
    const t = layoutTokens(true);
    expect(t.color.white).toBe('#000000'); // surfaces
    expect(t.color.navy).toBe('#000000'); // frames, headers, buttons
    expect(t.color.text).toBe('#FFFFFF');
    expect(t.color.muted).toBe('#FFFFFF');
    expect(t.color.edge).toBe(t.color.gold);
    expect(t.color.line).toBe(t.color.gold);
    expect(t.border(1)).toBe(LARGE_TEXT_BORDER_WIDTH);
    expect(t.border(8)).toBe(8);
  });

  it('keeps every pairing high contrast', () => {
    expect(contrastRatio(HIGH_CONTRAST.text, HIGH_CONTRAST.white)).toBe(21);
    expect(contrastRatio(HIGH_CONTRAST.gold, HIGH_CONTRAST.white)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(HIGH_CONTRAST.red, HIGH_CONTRAST.white)).toBeGreaterThanOrEqual(4.5);
    // White type on the red (danger) and green fills, at the layout's large bold sizes (WCAG large text: 3:1).
    expect(contrastRatio(HIGH_CONTRAST.text, HIGH_CONTRAST.red)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(HIGH_CONTRAST.text, HIGH_CONTRAST.green)).toBeGreaterThanOrEqual(4.5);
  });

  it('reads the member flag', () => {
    expect(prefersLargeText(null)).toBe(false);
    expect(prefersLargeText({})).toBe(false);
    expect(prefersLargeText({ flag_large_text_mode: 0 })).toBe(false);
    expect(prefersLargeText({ flag_large_text_mode: 1 })).toBe(true);
    expect(LARGE_TEXT_TOGGLE_LABEL).toBe('[ 👓 Enable Large Text Layout Mode ]');
  });
});

describe('schema 34', () => {
  it('adds the member column, off by default', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Member\] ADD \[flag_large_text_mode\] BIT NOT NULL DEFAULT 0;/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 34;/);
    expect(read('data_dictionary.md')).toContain('flag_large_text_mode (BIT, NOT NULL, DEFAULT 0)');
  });

  it('is one of the columns a member may change on their own record', () => {
    expect(MEMBER_SELF_SERVICE_COLUMNS).toContain('flag_large_text_mode');
  });
});

describe.each(drivers)('$name driver: Member.flag_large_text_mode', (d) => {
  it('starts off for every member', async () => {
    const db = await d.make();
    for (const id of Object.values(MEMBER)) expect((await db.members.get(id))?.flag_large_text_mode).toBe(0);
  });

  it('lets a member switch their own layout on and off', async () => {
    const db = await d.make();
    expect(await db.members.update(MEMBER.member, MEMBER.member, { flag_large_text_mode: 1 })).toMatchObject({ flag_large_text_mode: 1 });
    expect(prefersLargeText(await db.members.get(MEMBER.member))).toBe(true);
    await db.members.update(MEMBER.member, MEMBER.member, { flag_large_text_mode: 0 });
    expect(prefersLargeText(await db.members.get(MEMBER.member))).toBe(false);
  });

  it("refuses a member changing someone else's layout, and writes nothing", async () => {
    const db = await d.make();
    const err = await expectRule(db.members.update(MEMBER.member, MEMBER.admin, { flag_large_text_mode: 1 }), 'ADMIN_REQUIRED');
    expect(err).toBeInstanceOf(SecurityPrivilegeError);
    expect((await db.members.get(MEMBER.admin))?.flag_large_text_mode).toBe(0);
  });

  it("lets an Admin set it for a member of their council (helping them set up the phone)", async () => {
    const db = await d.make();
    expect(await db.members.update(MEMBER.admin, MEMBER.member, { flag_large_text_mode: 1 })).toMatchObject({ flag_large_text_mode: 1 });
  });

  it('rejects a value that is not 0, 1, true or false', async () => {
    const db = await d.make();
    await expectRule(db.members.update(MEMBER.member, MEMBER.member, { flag_large_text_mode: 2 }), 'INVALID_INPUT');
    await expectRule(db.members.update(MEMBER.member, MEMBER.member, { flag_large_text_mode: 'yes' as unknown as number }), 'INVALID_INPUT');
    expect((await db.members.get(MEMBER.member))?.flag_large_text_mode).toBe(0);
  });

  it("keeps the member's choice through an Admin's roster edit that leaves it out", async () => {
    const db = await d.make();
    await db.members.update(MEMBER.member, MEMBER.member, { flag_large_text_mode: 1 });
    await db.members.update(MEMBER.admin, MEMBER.member, { City: 'Springfield' });
    expect(await db.members.get(MEMBER.member)).toMatchObject({ City: 'Springfield', flag_large_text_mode: 1 });
  });
});

describe('phone screens draw from the layout tokens', () => {
  const mobile = join(root, 'apps/mobile');
  const sources = (['app', 'components'] as const).flatMap((dir) =>
    (readdirSync(join(mobile, dir), { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => ({ file: `${dir}/${f.replaceAll('\\', '/')}`, text: readFileSync(join(mobile, dir, f), 'utf8') })),
  );

  it('found the screens', () => {
    expect(sources.map((s) => s.file)).toEqual(expect.arrayContaining(['app/(app)/log.tsx', 'app/(app)/settings.tsx', 'components/ui.tsx']));
  });

  it.each(sources.map((s) => [s.file, s.text] as const))('%s takes no colours or sizes from the static theme', (_file, text) => {
    // useTheme() swaps in the large text layout; the static constants would stay standard.
    const themeImport = /import \{([^}]*)\} from '@\/lib\/theme';/.exec(text)?.[1] ?? '';
    for (const name of ['color', 'space', 'radius', 'touchTarget']) expect(themeImport.split(',').map((n) => n.trim())).not.toContain(name);
  });

  it('puts the switch on the phone settings screen and the web profile', () => {
    expect(read('apps/mobile/app/(app)/settings.tsx')).toContain('LARGE_TEXT_TOGGLE_LABEL');
    expect(read('apps/web/app/profile/page.tsx')).toContain('LARGE_TEXT_TOGGLE_LABEL');
    expect(read('apps/mobile/lib/app-context.tsx')).toContain('<LayoutModeProvider large={largeText}>');
  });
});
