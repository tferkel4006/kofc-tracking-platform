// The web portal's Tailwind theme (apps/web/app/globals.css) and the tokens the mobile app imports
// (packages/shared/src/theme.ts) must describe the same brand: Arial body copy, Navy / Red / Gold on White.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND, contrastRatio, FONT_BODY, FONT_HEADING } from '@kofc/shared';

const webRoot = fileURLToPath(new URL('../apps/web/', import.meta.url));
const css = readFileSync(join(webRoot, 'app/globals.css'), 'utf8');

/**
 * Every .ts/.tsx/.css source file the portal ships. Block comments are dropped so a comment that names an
 * off-brand class as a bad example (as globals.css does) is not mistaken for code that uses it.
 */
function portalSources(): { file: string; text: string }[] {
  return (['app', 'components', 'lib'] as const).flatMap((dir) =>
    (readdirSync(join(webRoot, dir), { recursive: true }) as string[])
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .map((f) => ({
        file: `${dir}/${f.replaceAll('\\', '/')}`,
        text: readFileSync(join(webRoot, dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
      })),
  );
}

const token = (name: string): string | undefined => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe('web theme matches the shared brand tokens', () => {
  it.each([
    ['color-navy', BRAND.navy],
    ['color-brand-red', BRAND.red],
    ['color-gold', BRAND.gold],
    ['color-white', BRAND.white],
    ['color-muted', BRAND.muted],
    ['color-line', BRAND.line],
  ])('--%s is %s', (name, expected) => {
    expect(token(name)?.toUpperCase()).toBe(expected.toUpperCase());
  });

  it('uses Arial for body copy and the shared serif for titles', () => {
    expect(FONT_BODY).toBe('Arial, sans-serif');
    expect(token('font-sans')).toBe(FONT_BODY);
    expect(token('font-serif')).toBe(FONT_HEADING);
    expect(css).toMatch(/html\s*\{[^}]*font-family:\s*Arial, sans-serif/);
  });

  it('switches off the default Tailwind palette so an off-brand colour cannot compile', () => {
    expect(css).toContain('--color-*: initial;');
  });
});

describe('portal sources stay on brand', () => {
  const sources = portalSources();

  it('finds the portal pages', () => {
    const files = sources.map((s) => s.file);
    for (const page of ['app/lookups/page.tsx', 'app/events/page.tsx', 'app/meetings/page.tsx', 'app/ledger/page.tsx']) {
      expect(files).toContain(page);
    }
  });

  it('uses no Tailwind palette colour such as bg-blue-500', () => {
    const offPalette =
      /\b(?:bg|text|border|outline|ring|fill|stroke|from|to|via|divide|accent|decoration|placeholder|caret|shadow)-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    const offenders = sources.filter((s) => offPalette.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('hard-codes no hex colour outside the brand tokens', () => {
    const brand = new Set(Object.values(BRAND).map((c) => c.toUpperCase()));
    const stray = sources.flatMap((s) => (s.text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).filter((c) => !brand.has(c.toUpperCase())).map((c) => `${s.file}: ${c}`));
    expect(stray).toEqual([]);
  });

  it('never sets a page font other than the Arial body stack or the serif title stack', () => {
    const offenders = sources.filter((s) => /font-(?:mono|\[)/.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});

describe('brand contrast', () => {
  it('keeps text readable on white and on navy', () => {
    expect(contrastRatio(BRAND.navy, BRAND.white)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(BRAND.muted, BRAND.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BRAND.red, BRAND.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BRAND.navy, BRAND.gold)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BRAND.gold, BRAND.navy)).toBeGreaterThanOrEqual(4.5);
  });
});
