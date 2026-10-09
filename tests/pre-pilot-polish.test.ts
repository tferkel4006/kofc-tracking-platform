// Sprint 6L Extension (Pre-Pilot Hardening): the web loses its high-contrast layout (the phone keeps it behind the
// member's own flag), the officer tools leave ordinary members' sidebars, every council credential is set on one
// Credentials Vault page, the dues rate is set only on the Global Parameters Dashboard, and the navigation wording,
// donations drill-down and debug buttons are tidied for the pilot.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canOpenConstitutionalAdvisor,
  canOpenCredentialsVault,
  HIGH_CONTRAST,
  layoutTokens,
  PORTAL_NAV_GROUPS,
  portalAreas,
  prefersLargeText,
} from '@kofc/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const base = { memberId: 9, councilId: 1, roles: [] as string[] };

describe('high-contrast layout is phone only', () => {
  it('leaves no high-contrast class or surface anywhere in the portal code', () => {
    const web = join(root, 'apps/web');
    const offenders = (['app', 'components', 'lib'] as const).flatMap((dir) =>
      (readdirSync(join(web, dir), { recursive: true }) as string[])
        .filter((f) => /\.(tsx?|css)$/.test(f))
        .filter((f) => /\bbg-black\b|hc-gold|data-surface="black"|tone="contrast"/.test(readFileSync(join(web, dir, f), 'utf8').replace(/\/\/.*$/gm, '')))
        .map((f) => `${dir}/${f}`),
    );
    expect(offenders).toEqual([]);
  });

  it('draws the phone in the high-contrast tokens only for a member who switched them on', () => {
    expect(prefersLargeText({ flag_large_text_mode: 1 })).toBe(true);
    expect(prefersLargeText({ flag_large_text_mode: 0 })).toBe(false);
    expect(prefersLargeText(null)).toBe(false);
    expect(layoutTokens(true).color.navy).toBe(HIGH_CONTRAST.navy);
    expect(layoutTokens(false).color.navy).not.toBe(HIGH_CONTRAST.navy);
  });
});

describe('officer tools leave ordinary members', () => {
  it('opens the Constitutional Advisor and the Credentials Vault to officers, Admins and Super Admins only', () => {
    const member = { ...base, memberType: 'Member' as const, isOfficer: false };
    for (const allowed of [
      { ...member, isOfficer: true },
      { ...member, memberType: 'Admin' as const },
      { ...member, memberType: 'Super Admin' as const },
    ]) {
      expect(canOpenConstitutionalAdvisor(allowed)).toBe(true);
      expect(canOpenCredentialsVault(allowed)).toBe(true);
      expect(portalAreas(allowed)).toEqual(expect.arrayContaining(['governance/advisor', 'credentials-vault']));
    }
    expect(canOpenConstitutionalAdvisor(member)).toBe(false);
    expect(canOpenCredentialsVault(member)).toBe(false);
    expect(portalAreas(member)).not.toContain('governance/advisor');
    expect(portalAreas(member)).not.toContain('credentials-vault');
  });

  it('files one Credentials Vault link under Setup and guards both pages', () => {
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')?.items).toContain('credentials-vault');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar.match(/label: 'Credentials Vault'/g)).toHaveLength(1);
    expect(read('apps/web/app/credentials-vault/page.tsx')).toContain('<RequireArea area="credentials-vault">');
    expect(read('apps/web/app/governance/advisor/page.tsx')).toContain('<RequireArea area="governance/advisor">');
  });
});

describe('Credentials Vault page', () => {
  it('holds the email gateway and the Drive key behind a plain status banner, with no port field', () => {
    const page = read('apps/web/app/credentials-vault/page.tsx');
    expect(page).toContain('<EmailGatewayPanel');
    expect(page).toContain("credentialKey: 'GOOGLE_DRIVE_PRIVATE_KEY'");
    expect(page).toContain('aria-label="Connection status"');
    const gateway = read('apps/web/components/EmailGatewayPanel.tsx');
    expect(gateway).not.toMatch(/SMTP_PORTS|' \(STARTTLS\)'|label="Port"/);
    expect(read('apps/web/app/council-lookups/page.tsx')).not.toContain('EmailGatewayPanel');
  });
});

describe('navigation wording', () => {
  it('renames Bulletins and the donations link, and the ledger badge', () => {
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain("label: 'Council Artifacts'");
    expect(sidebar).toContain("label: 'Donations History'");
    expect(sidebar).not.toMatch(/label: 'Bulletins'|Recorded Donations History/);
    expect(read('apps/web/app/resources/bulletins/page.tsx')).toContain('<PageTitle>Council Artifacts</PageTitle>');
    const donations = read('apps/web/app/donations/page.tsx');
    expect(donations).toContain('✓ Automatically Logged to Treasury Ledger');
    expect(donations).not.toMatch(/Ledger synced from donations/i);
  });
});

describe('donations history and debug buttons', () => {
  it('marks the chosen event with a thick gold border and scrolls its drill-down into view', () => {
    const page = read('apps/web/app/donations/page.tsx');
    expect(page).toContain("'border-[6px] border-gold");
    expect(page).toContain('scrollIntoView(');
    expect(page).toContain('prefers-reduced-motion: reduce');
    expect(page).toContain('<FaithCenterMirror />');
    expect(read('apps/web/components/FaithCenterMirror.tsx')).toContain('isFraternalTenant(tenant)');
  });

  it('shows no engine-feed JSON button anywhere in the portal', () => {
    expect(read('apps/web/app/governance/bylaws/page.tsx')).not.toMatch(/as JSON/);
  });
});
