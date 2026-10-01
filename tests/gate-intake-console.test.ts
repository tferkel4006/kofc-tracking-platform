// Sprint 5Z-10: the high-speed gate intake (events.setIntakeSessionStatus and the one-tap donation entries), the Live
// Meeting Console's helpers (agenda quick picks, the countdown, the checked-in roster) and its permission mirror.
import { describe, expect, it } from 'vitest';
import {
  agendaTopics,
  BusinessRuleError,
  canRunLiveAssembly,
  DonationSessionController,
  formatCountdown,
  GATE_INTAKE_TARGETS,
  gateIntakeEntry,
  portalAreas,
  type CouncilDonationOption,
  type DataService,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const OWN = 1;

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as BusinessRuleError).code;
  }
  return undefined;
};

const option = (id: number, name: string, kind: CouncilDonationOption['kind']): CouncilDonationOption => ({
  method: { id, DonationMethod: name },
  kind,
  link: { id, CouncilID: OWN, DonationMethodID: id } as CouncilDonationOption['link'],
  qrCodeUrl: null,
});

describe('gate intake entries (pure)', () => {
  const options = [option(3, 'Venmo', 'qr'), option(1, 'Cash', 'cash'), option(2, 'Credit Card', 'card')];

  it('logs the cash or card method at the tapped amount, with the session type and a gate description', () => {
    expect(gateIntakeEntry('cash', 10, options, [{ id: 4 }, { id: 5 }], { donationTypeId: 5 })).toEqual({
      DonationMethodID: 1,
      DonationAmount: 10,
      DonationTypeID: 5,
      Donor: null,
      DonationDesciption: GATE_INTAKE_TARGETS.cash.description,
    });
    expect(gateIntakeEntry('card', 25, options, [{ id: 4 }], {})).toMatchObject({ DonationMethodID: 2, DonationTypeID: 4, DonationDesciption: 'Gate intake: Stripe card swipe' });
  });

  it('refuses a method the council has not enabled, or a council without donation types', () => {
    expect(code(() => gateIntakeEntry('card', 10, [option(1, 'Cash', 'cash')], [{ id: 4 }], {}))).toBe('INVALID_INPUT');
    expect(code(() => gateIntakeEntry('cash', 10, options, [], {}))).toBe('INVALID_INPUT');
  });
});

describe('live console helpers (pure)', () => {
  it('turns the meeting agenda into quick-pick topics', () => {
    expect(agendaTopics('1. Opening prayer\n2) Roll call of officers\n\n- Minutes\n• Good of the Order\r\nClosing')).toEqual([
      'Opening prayer',
      'Roll call of officers',
      'Minutes',
      'Good of the Order',
      'Closing',
    ]);
    expect(agendaTopics(null)).toEqual([]);
  });

  it('reads the countdown as mm:ss', () => {
    expect([formatCountdown(600), formatCountdown(61), formatCountdown(0), formatCountdown(-5)]).toEqual(['10:00', '01:01', '00:00', '00:00']);
  });

  it('opens the console to the chair: officers, Admins, the owner and Super Admins', () => {
    const actor = (over = {}) => ({ memberId: 10, councilId: OWN, memberType: 'Member' as const, isOfficer: false, ...over });
    const meeting = { CouncilID: OWN, OwnerID: 99 };
    expect(canRunLiveAssembly(actor({ isOfficer: true, roles: ['Recorder'] }), meeting)).toBe(true);
    expect(canRunLiveAssembly(actor({ memberType: 'Admin' }), meeting)).toBe(true);
    expect(canRunLiveAssembly(actor({ memberType: 'Super Admin', councilId: 2 }), meeting)).toBe(true);
    expect(canRunLiveAssembly(actor({ memberId: 99 }), meeting)).toBe(true);
    expect(canRunLiveAssembly(actor(), meeting)).toBe(false);
    expect(canRunLiveAssembly(actor({ isOfficer: true, councilId: 2 }), meeting)).toBe(false);
    expect(portalAreas(actor({ isOfficer: true }))).toContain('meetings/live');
    expect(portalAreas(actor())).not.toContain('meetings/live');
  });
});

/** An event linked to council 1 that has started. */
async function startedEvent(db: DataService): Promise<number> {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const event = await db.events.create(
    { EventName: 'Fish Fry Gate', EventDescription: 'Lenten fish fry', OwnerID: MEMBER.admin, StartDate: '2026-01-01', EndDate: iso, Location: 'Parish Hall', CategoryID: 1 },
    [OWN],
  );
  return event.id;
}

describe.each(drivers)('gate intake ($name driver)', (d) => {
  it('opens and closes an event intake for members of its councils, defaulting to Inactive', async () => {
    const db = await d.make();
    const eventId = await startedEvent(db);
    expect((await db.events.get(eventId))?.IntakeSessionStatus).toBe('Inactive');
    expect((await db.events.setIntakeSessionStatus(MEMBER.member, eventId, 'Active')).IntakeSessionStatus).toBe('Active');
    expect((await db.events.get(eventId))?.IntakeSessionStatus).toBe('Active');
    expect((await db.events.setIntakeSessionStatus(MEMBER.admin, eventId, 'Inactive')).IntakeSessionStatus).toBe('Inactive');
    await expectRule(db.events.setIntakeSessionStatus(MEMBER.member, eventId, 'Open' as never), 'INVALID_INPUT');
    await expectRule(db.events.setIntakeSessionStatus(MEMBER.member, 9999, 'Active'), 'EVENT_NOT_FOUND');
    await expectRule(db.events.setIntakeSessionStatus(9999, eventId, 'Active'), 'MEMBER_NOT_FOUND');
  });

  it('refuses members of councils the event is not linked to', async () => {
    const db = await d.make();
    const event = await db.events.create(
      { EventName: 'Other Council Fair', EventDescription: 'Fair', OwnerID: MEMBER.admin, StartDate: '2026-01-01', EndDate: '2026-01-02', Location: 'Field', CategoryID: 1 },
      [2],
    );
    await expectRule(db.events.setIntakeSessionStatus(MEMBER.member, event.id, 'Active'), 'COUNCIL_ACCESS_DENIED');
    expect((await db.events.setIntakeSessionStatus(MEMBER.superAdmin, event.id, 'Active')).IntakeSessionStatus).toBe('Active');
  });

  it('logs a one-tap gate donation to the pinned event with nothing typed', async () => {
    const db = await d.make();
    const eventId = await startedEvent(db);
    const methods = await db.donations.listMethods(OWN);
    const types = await db.donations.listTypes(OWN);
    const session = new DonationSessionController(db, OWN, MEMBER.member);
    await session.start(eventId, { amount: 20 });
    const target = methods.some((m) => m.kind === 'cash') ? 'cash' : 'card';
    const saved = await session.record(gateIntakeEntry(target, 20, methods, types, {}));
    expect(saved).toMatchObject({ EventID: eventId, CouncilID: OWN, DonationAmount: 20, RecordedBy: MEMBER.member, DonationDesciption: GATE_INTAKE_TARGETS[target].description });
  });
});

describe.each(drivers)('live console roster ($name driver)', (d) => {
  it('lists who is checked in, so the console marks them', async () => {
    const db = await d.make();
    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, 1, '2026-2027');
    const [meeting] = await db.meetings.listUpcoming(OWN);
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meeting.id);
    await db.meetings.logLiveAttendanceOverride(MEMBER.member, meeting.id, MEMBER.member);
    await db.meetings.logLiveAttendanceOverride(MEMBER.admin, meeting.id, MEMBER.superAdmin);
    const state = await db.meetings.getLiveAssemblyState(MEMBER.admin, meeting.id);
    expect(state.checkedInMemberIds).toEqual([MEMBER.superAdmin, MEMBER.member]);
  });
});
