// Sprint 6C (Phase 4, Schema 36): the AI Generative Marketing Factory - flyer copy and facts (composeFlyerCopy,
// flyerFacts), the historical photo loop (pastEditions, pastEditionPhotos, GoogleDriveVault.listImages over
// Media / <past event name>), the vector icon fallback, the printable HTML layout (buildFlyerHtml) and the flyer's
// Drive file id column (Event.GoogleDriveFlyerFileID, events.setFlyerFile).
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertDriveVaultUpload,
  BRAND,
  bulletinCards,
  buildFlyerHtml,
  canOpenMarketingFactory,
  cleanDriveVaultSubfolder,
  cleanFlyerFileId,
  composeFlyerCopy,
  driveVaultFolderPath,
  eventSeriesKey,
  FLYER_ICONS,
  FLYER_MAX_PHOTOS,
  flyerFacts,
  flyerFileName,
  flyerIconFor,
  flyerPlaceholders,
  isRecurringEdition,
  marketingJargonHits,
  pastEditionFolderNames,
  pastEditionPhotos,
  pastEditions,
  PORTAL_NAV_GROUPS,
  portalAreas,
  type Event,
  type NewEvent,
} from '@kofc/shared';
import { GoogleDriveVault } from '../apps/web/services/google-drive';
import { drivers, expectRule, MEMBER } from './helpers';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const ev = (over: Partial<Event>): Event => ({
  id: 1,
  EventName: 'Lenten Fish Fry',
  EventDescription: 'Fried fish, fries and coleslaw in the parish hall.',
  OwnerID: 2,
  StartDate: '2027-03-12',
  EndDate: '2027-03-12',
  Location: "St. Mary's Parish Hall, 100 Main St",
  CategoryID: 5,
  ...over,
});

describe('past editions of a recurring event', () => {
  const events = [
    ev({ id: 10, EventName: 'Lenten Fish Fry 2027', StartDate: '2027-03-12' }),
    ev({ id: 9, EventName: 'Lenten Fish Fry 2026', StartDate: '2026-03-13', PhotoGalleryURL: `${DRIVE_ID},events/9/a.jpg` }),
    ev({ id: 8, EventName: 'lenten fish-fry', StartDate: '2025-03-14', PhotoGalleryURL: 'blob:http://x/1#a.jpg,events/8/b.jpg,events/9/a.jpg' }),
    ev({ id: 7, EventName: 'Pancake Breakfast', StartDate: '2025-01-01', PhotoGalleryURL: 'events/7/c.jpg' }),
    ev({ id: 11, EventName: 'Lenten Fish Fry 2028', StartDate: '2028-03-10' }),
  ];

  it('matches the series by name with years and punctuation dropped, newest first, earlier dates only', () => {
    expect(eventSeriesKey('Lenten Fish-Fry 2026!')).toBe('lenten fish fry');
    expect(pastEditions(events[0], events).map((e) => e.id)).toEqual([9, 8]);
    expect(pastEditions(ev({ id: 99, EventName: 'Coat Drive' }), events)).toEqual([]);
  });

  it('calls an event recurring when it is annual or has a past edition', () => {
    expect(isRecurringEdition(ev({ IsAnnual: 0 }), [events[1]])).toBe(true);
    expect(isRecurringEdition(ev({ IsAnnual: 1 }), [])).toBe(true);
    expect(isRecurringEdition(ev({ IsAnnual: 0 }), [])).toBe(false);
  });

  it('collects saved photos newest edition first, without blob links or repeats, capped', () => {
    const editions = pastEditions(events[0], events);
    expect(pastEditionPhotos(editions)).toEqual([DRIVE_ID, 'events/9/a.jpg', 'events/8/b.jpg']);
    expect(pastEditionPhotos(editions, 2)).toHaveLength(2);
    expect(pastEditionFolderNames(editions)).toEqual(['Lenten Fish Fry 2026', 'lenten fish-fry']);
  });
});

describe('flyer copy and facts', () => {
  it('sets the date, the first-day shift hours and the address, with placeholders for what the records lack', () => {
    const shifts = [
      { ShiftDate: '2027-03-12', StartTime: '17:00:00', EndTime: '19:00:00' },
      { ShiftDate: '2027-03-12', StartTime: '16:30:00', EndTime: '20:00:00' },
      { ShiftDate: '2027-03-13', StartTime: '08:00:00', EndTime: '22:00:00' },
    ];
    expect(flyerFacts(ev({}), shifts)).toEqual({ date: 'Friday, March 12, 2027', time: '4:30 PM – 8:00 PM', address: "St. Mary's Parish Hall, 100 Main St" });
    const bare = flyerFacts(ev({ EndDate: '2027-03-14', Location: ' ' }), []);
    expect(bare).toEqual({ date: 'Friday, March 12, 2027 – Sunday, March 14, 2027', time: '[TIME]', address: '[ADDRESS]' });
    expect(flyerPlaceholders(bare)).toEqual(['[TIME]', '[ADDRESS]']);
  });

  it('writes warm copy from the event itself and never trips the jargon scan', () => {
    for (const kind of Object.keys(FLYER_ICONS) as (keyof typeof FLYER_ICONS)[]) {
      for (const recurring of [true, false]) {
        const copy = composeFlyerCopy({ event: ev({ EventDescription: '' }), icon: kind, recurring, councilName: 'St. Jude Council' });
        expect(marketingJargonHits(Object.values(copy).join(' '))).toEqual([]);
        expect(copy.callToAction).toMatch(/all are welcome/);
        expect(copy.hostLine).toBe('Hosted by the Knights of Columbus, St. Jude Council');
        expect(Object.values(copy).join(' ')).not.toMatch(/\d/);
      }
    }
    const copy = composeFlyerCopy({ event: ev({}), icon: 'fish', recurring: true, councilName: 'St. Jude Council' });
    expect(copy.headline).toBe('Lenten Fish Fry');
    expect(copy.body).toBe('Fried fish, fries and coleslaw in the parish hall.');
    expect(copy.subhead).toMatch(/tradition returns/);
  });

  it('catches the banned marketing terms', () => {
    expect(marketingJargonHits('We leverage synergy to delight customers with modules')).toEqual(['leverage', 'synergy', 'customers', 'modules']);
  });

  it('picks the fallback icon by keyword, then by category, then a calendar', () => {
    expect(flyerIconFor(ev({}), 'Fundraising')).toBe('fish');
    expect(flyerIconFor(ev({ EventName: 'Coats for Kids', EventDescription: 'Winter coat drive' }), 'Service')).toBe('drive');
    expect(flyerIconFor(ev({ EventName: 'Family Rosary', EventDescription: '' }), null)).toBe('faith');
    expect(flyerIconFor(ev({ EventName: 'Council Social', EventDescription: '' }), 'Fellowship')).toBe('fellowship');
    expect(flyerIconFor(ev({ EventName: 'Gathering', EventDescription: '' }), null)).toBe('calendar');
  });
});

describe('printable flyer layout', () => {
  const copy = composeFlyerCopy({ event: ev({ EventName: 'Fish <Fry> & "Fun"' }), icon: 'fish', recurring: true, councilName: 'St. Jude Council' });
  const facts = flyerFacts(ev({}), []);

  it('embeds up to four past photos, escaping every value and dropping unsafe sources', () => {
    const html = buildFlyerHtml({
      copy,
      facts,
      icon: 'fish',
      photos: ['https://drive.google.com/thumbnail?id=A&sz=w1600', 'javascript:alert(1)', '//evil.example/x.jpg', '/media/a.jpg', 'https://b', 'https://c', 'https://d'],
    });
    expect(html.match(/<img /g)).toHaveLength(FLYER_MAX_PHOTOS);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('Fish &lt;Fry&gt; &amp; &quot;Fun&quot;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<svg');
  });

  it('draws the vector icon when there are no photos, in the navy and gold tokens with large facts', () => {
    const html = buildFlyerHtml({ copy, facts, icon: 'fish', photos: [] });
    expect(html).toContain('<svg');
    expect(html).toContain('aria-label="Fish"');
    expect(html).toContain(BRAND.navy);
    expect(html).toContain(BRAND.gold);
    expect(html).toMatch(/\.fact-value \{[^}]*font-size: 26pt/);
    for (const label of ['Date', 'Time', 'Address']) expect(html).toContain(`<span class="fact-label">${label}</span>`);
    expect(html).toContain('@page { size: letter');
  });

  it('names the file after the event', () => {
    expect(flyerFileName("St. Mary's Fish Fry 2027")).toBe('st-mary-s-fish-fry-2027-flyer.html');
    expect(flyerFileName('***')).toBe('event-flyer.html');
  });
});

describe('Drive vault: flyers and event media folders', () => {
  it('files flyers under Flyers and media under the event folder', () => {
    expect(driveVaultFolderPath('flyer')).toEqual(['Fraternal Enterprise Suite', 'Flyers']);
    expect(driveVaultFolderPath('media', 'Lenten Fish Fry')).toEqual(['Fraternal Enterprise Suite', 'Media', 'Lenten Fish Fry']);
    expect(driveVaultFolderPath('voucher', 'ignored')).toEqual(['Fraternal Enterprise Suite', 'Vouchers']);
    expect(assertDriveVaultUpload({ kind: 'flyer', name: 'f.html', mimeType: 'text/html', size: 10 })).toBe('flyer');
    expect(() => assertDriveVaultUpload({ kind: 'flyer', name: 'f.jpg', mimeType: 'image/jpeg', size: 10 })).toThrow();
  });

  it('cleans an event folder name and refuses path tricks', () => {
    expect(cleanDriveVaultSubfolder('  Lenten   Fish Fry ')).toBe('Lenten Fish Fry');
    expect(cleanDriveVaultSubfolder('')).toBeNull();
    expect(cleanDriveVaultSubfolder(null)).toBeNull();
    for (const bad of ['a/b', 'a\\b', 'x'.repeat(101), 'bell\u0007x']) expect(() => cleanDriveVaultSubfolder(bad)).toThrow();
  });

  it('accepts only a bare Drive file id for the flyer column', () => {
    expect(cleanFlyerFileId(` ${DRIVE_ID} `)).toBe(DRIVE_ID);
    expect(cleanFlyerFileId(null)).toBeNull();
    for (const bad of ['https://drive.google.com/x', 'blob:x', '', 5]) expect(() => cleanFlyerFileId(bad)).toThrow();
  });

  it('lists the images in an existing past-event folder without creating anything', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const creds = { clientEmail: 'v@x.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), sharedDriveId: 'DRIVE0' };
    const queries: string[] = [];
    const methods: string[] = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'tok', expires_in: 3600 });
      methods.push(init?.method ?? 'GET');
      const q = new URL(url).searchParams.get('q') ?? '';
      queries.push(q);
      if (q.includes("mimeType contains 'image/'")) return json({ files: [{ id: 'IMG1' }, { id: 'IMG2' }] });
      if (q.includes("name = 'Missing'")) return json({ files: [] });
      return json({ files: [{ id: `F-${queries.length}` }] });
    }) as typeof fetch;
    const vault = new GoogleDriveVault(creds, fake);
    expect(await vault.listImages(['Fraternal Enterprise Suite', 'Media', "St. Mary's Fry"], 4)).toEqual(['IMG1', 'IMG2']);
    expect(queries[2]).toContain("name = 'St. Mary\\'s Fry'");
    expect(queries[3]).toContain("'F-3' in parents");
    expect(await vault.listImages(['Fraternal Enterprise Suite', 'Missing', 'X'], 4)).toEqual([]);
    expect(methods.every((m) => m === 'GET')).toBe(true);
  });
});

describe('portal wiring', () => {
  const base = { memberId: 9, councilId: 1, isOfficer: false, roles: [] as string[] };

  it('opens the factory to Admins and officers, files it under Resources, and links it in the sidebar', () => {
    expect(canOpenMarketingFactory({ ...base, memberType: 'Admin' })).toBe(true);
    expect(canOpenMarketingFactory({ ...base, memberType: 'Member', isOfficer: true })).toBe(true);
    expect(canOpenMarketingFactory({ ...base, memberType: 'Member' })).toBe(false);
    expect(portalAreas({ ...base, memberType: 'Member' })).not.toContain('resources/marketing');
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'resources')?.items).toContain('resources/marketing');
    expect(read('apps/web/components/Sidebar.tsx')).toMatch(/'resources\/marketing': \{\s*href: '\/resources\/marketing',\s*label: 'Marketing Factory'/);
    expect(read('apps/web/app/resources/marketing/page.tsx')).toContain('AI Generative Marketing Factory');
  });

  it('adds the flyer column at schema 36 and shows filed flyers on the bulletins board', () => {
    expect(read('Schema.sql')).toMatch(/ALTER TABLE \[Event\] ADD \[GoogleDriveFlyerFileID\] VARCHAR\(128\) NULL;/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 36;/);
    expect(read('data_dictionary.md')).toContain('GoogleDriveFlyerFileID (VARCHAR(128), NULL)');
    const cards = bulletinCards([], [{ id: 4, EventName: 'Fish Fry', StartDate: '2027-03-12', PhotoGalleryURL: null, GoogleDriveFlyerFileID: DRIVE_ID }]);
    expect(cards.map((c) => [c.key, c.kind])).toEqual([['event-4-flyer', 'Flyer']]);
  });
});

const newEvent = (): NewEvent => ({
  EventName: 'Lenten Fish Fry',
  EventDescription: 'Fish in the hall.',
  OwnerID: MEMBER.member,
  StartDate: '2027-03-12',
  EndDate: '2027-03-12',
  Location: 'Parish Hall',
  CategoryID: 5,
});

describe.each(drivers)('$name driver: events.setFlyerFile', (d) => {
  it('records, keeps through update and copy rules, and clears the flyer file id', async () => {
    const db = await d.make();
    const created = await db.events.create(newEvent(), [1]);
    expect(created.GoogleDriveFlyerFileID ?? null).toBeNull();
    expect((await db.events.setFlyerFile(MEMBER.admin, created.id, DRIVE_ID)).GoogleDriveFlyerFileID).toBe(DRIVE_ID);
    await db.events.update(created.id, { Location: 'New Hall' });
    expect((await db.events.listByCouncil(1)).find((e) => e.id === created.id)?.GoogleDriveFlyerFileID).toBe(DRIVE_ID);
    const twin = await db.events.copy(created.id, { startDate: '2028-03-10' });
    expect(twin.GoogleDriveFlyerFileID ?? null).toBeNull();
    // The event's owner may file its flyer too (the event media rule).
    expect((await db.events.setFlyerFile(MEMBER.member, created.id, null)).GoogleDriveFlyerFileID).toBeNull();
  });

  it('refuses a stranger, a bad id and an unknown event, writing nothing', async () => {
    const db = await d.make();
    const created = await db.events.create({ ...newEvent(), OwnerID: MEMBER.admin }, [1]);
    await expectRule(db.events.setFlyerFile(MEMBER.member, created.id, DRIVE_ID), 'ADMIN_REQUIRED');
    await expectRule(db.events.setFlyerFile(MEMBER.admin, created.id, 'https://drive.google.com/x'), 'INVALID_INPUT');
    await expectRule(db.events.setFlyerFile(MEMBER.admin, 99_999, DRIVE_ID), 'EVENT_NOT_FOUND');
    expect((await db.events.listByCouncil(1)).find((e) => e.id === created.id)?.GoogleDriveFlyerFileID ?? null).toBeNull();
  });
});
